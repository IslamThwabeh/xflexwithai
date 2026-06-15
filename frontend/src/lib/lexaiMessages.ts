type MessageWithDate = {
  createdAt?: string | number | Date | null;
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupLexaiMessagesByDay<T extends MessageWithDate>(
  messages: T[],
  locale: string,
) {
  const groups: Array<{ key: string; label: string; messages: T[] }> = [];
  const groupMap = new Map<string, { key: string; label: string; messages: T[] }>();

  for (const message of messages) {
    const date = new Date(message.createdAt ?? "");
    const validDate = Number.isNaN(date.getTime()) ? new Date(0) : date;
    const key = getLocalDateKey(validDate);
    let group = groupMap.get(key);

    if (!group) {
      group = {
        key,
        label: Number.isNaN(date.getTime())
          ? "-"
          : validDate.toLocaleDateString(locale, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
        messages: [],
      };
      groupMap.set(key, group);
      groups.push(group);
    }

    group.messages.push(message);
  }

  return groups;
}
