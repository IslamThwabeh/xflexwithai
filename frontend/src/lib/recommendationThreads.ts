type RecommendationFeedMessage = {
  id: number;
  parentId?: number | null;
  type: string;
  createdAt?: string | null;
  threadStatus?: string | null;
  [key: string]: any;
};

export type RecommendationThread = {
  root: RecommendationFeedMessage;
  children: RecommendationFeedMessage[];
  latestActivityAt: string | null;
  latestActivityTs: number;
  hasResultChild: boolean;
  isClosed: boolean;
  paletteIndex: number;
};

export type RecommendationThreadDayGroup = {
  key: string;
  label: string;
  threads: RecommendationThread[];
};

const getTimestamp = (value: unknown) => {
  const timestamp = new Date(String(value ?? "")).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (left: Date, right: Date) => {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
};

const getDayLabel = (timestamp: number, language: string) => {
  if (!timestamp) {
    return language === "ar" ? "غير معروف" : "Unknown";
  }

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return language === "ar" ? "اليوم" : "Today";
  }

  if (isSameDay(date, yesterday)) {
    return language === "ar" ? "أمس" : "Yesterday";
  }

  return date.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function buildRecommendationThreads(
  messages: RecommendationFeedMessage[],
  options?: { openFirst?: boolean },
): RecommendationThread[] {
  const childrenMap = new Map<number, RecommendationFeedMessage[]>();

  for (const message of messages) {
    if (!message.parentId) continue;
    const children = childrenMap.get(message.parentId) ?? [];
    children.push(message);
    childrenMap.set(message.parentId, children);
  }

  for (const children of childrenMap.values()) {
    children.sort((left, right) => getTimestamp(left.createdAt) - getTimestamp(right.createdAt));
  }

  const threads = messages
    .filter((message) => !message.parentId && message.type === "recommendation")
    .map((root) => {
      const children = childrenMap.get(root.id) ?? [];
      const latestChild = children[children.length - 1];
      const latestActivityTs = Math.max(getTimestamp(root.createdAt), getTimestamp(latestChild?.createdAt));

      return {
        root,
        children,
        latestActivityAt: latestChild?.createdAt ?? root.createdAt ?? null,
        latestActivityTs,
        hasResultChild: children.some((child) => child.type === "result"),
        isClosed: root.threadStatus === "closed",
        paletteIndex: 0,
      } satisfies RecommendationThread;
    });

  threads.sort((left, right) => {
    if (options?.openFirst && left.isClosed !== right.isClosed) {
      return left.isClosed ? 1 : -1;
    }

    return right.latestActivityTs - left.latestActivityTs;
  });

  return threads.map((thread, index) => ({
    ...thread,
    paletteIndex: index % 2,
  }));
}

export function groupRecommendationThreadsByDay(
  threads: RecommendationThread[],
  language: string,
): RecommendationThreadDayGroup[] {
  const groups: RecommendationThreadDayGroup[] = [];

  for (const thread of threads) {
    const key = getDayKey(thread.latestActivityTs);
    const label = getDayLabel(thread.latestActivityTs, language);
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.threads.push(thread);
      continue;
    }

    groups.push({ key, label, threads: [thread] });
  }

  return groups;
}