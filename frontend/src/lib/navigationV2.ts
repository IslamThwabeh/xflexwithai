export type NavigationDestination = {
  path: string;
  label: string;
  keywords?: string;
  badge?: number;
};

export const ADMIN_NAVIGATION_GROUPS = [
  {
    id: "overview",
    en: "Overview",
    ar: "نظرة عامة",
    paths: ["/admin/dashboard"],
  },
  {
    id: "students",
    en: "Students & Learning",
    ar: "الطلاب والتعلّم",
    paths: [
      "/admin/students",
      "/admin/courses",
      "/admin/quizzes",
      "/admin/plan-progress",
      "/admin/student-surveys",
      "/admin/points",
      "/admin/community",
      "/admin/job-eligibility",
    ],
  },
  {
    id: "sales",
    en: "Sales & Access",
    ar: "المبيعات والتفعيل",
    paths: [
      "/admin/orders",
      "/admin/packages",
      "/admin/package-keys",
      "/admin/coupons",
      "/admin/brokers",
      "/admin/terms-acceptance",
    ],
  },
  {
    id: "finance",
    en: "Finance & Reports",
    ar: "المالية والتقارير",
    paths: [
      "/admin/finance",
      "/admin/finance/expenses",
      "/admin/finance/controls",
      "/admin/finance/reconciliation",
      "/admin/reports/subscribers",
      "/admin/reports/activations",
      "/admin/reports/expiry",
      "/admin/reports/brokers",
      "/admin/engagement",
      "/admin/finance/legacy-migrations",
    ],
  },
  {
    id: "services",
    en: "Services & Live",
    ar: "الخدمات واللايف",
    paths: [
      "/admin/recommendations",
      "/admin/lexai",
      "/admin/live-package",
      "/admin/live-expert",
      "/admin/copier",
      "/admin/live-package-review",
    ],
  },
  {
    id: "content",
    en: "Content & Marketing",
    ar: "المحتوى والتسويق",
    paths: [
      "/admin/articles",
      "/admin/events",
      "/admin/testimonials",
      "/admin/reviews",
      "/admin/jobs",
      "/admin/seo-owner-intake",
    ],
  },
  {
    id: "team",
    en: "Support & Team",
    ar: "الدعم والفريق",
    paths: [
      "/admin/support",
      "/admin/bug-reports",
      "/admin/roles",
      "/admin/staff-review",
      "/admin/staff-performance",
      "/admin/my-performance",
    ],
  },
  {
    id: "system",
    en: "System & Settings",
    ar: "النظام والإعدادات",
    paths: [
      "/admin/features",
      "/admin/notifications",
      "/admin/email-logs",
      "/admin/monitoring",
      "/admin/settings",
    ],
  },
] as const;

export const CLIENT_NAVIGATION_GROUPS = [
  {
    id: "learning",
    en: "My Learning",
    ar: "تعلّمي",
    paths: ["/courses", "/documents", "/quiz", "/surveys"],
  },
  {
    id: "services",
    en: "Services",
    ar: "الخدمات",
    paths: ["/lexai", "/recommendations", "/recommendations-performance", "/live-package"],
  },
  { id: "support", en: "Support", ar: "الدعم", paths: ["/support", "/guides"] },
  {
    id: "more",
    en: "More",
    ar: "المزيد",
    paths: ["/community", "/my-points", "/calculators", "/job-opportunities"],
  },
] as const;

export const CLIENT_ACCOUNT_PATHS = [
  "/my-packages",
  "/activate-key",
  "/broker-onboarding",
  "/admin/live-expert",
];

export function groupClientDestinations<T extends NavigationDestination>(
  items: T[],
  language: "ar" | "en"
) {
  const groupedPaths = new Set<string>(
    CLIENT_NAVIGATION_GROUPS.flatMap(group => [...group.paths])
  );
  return CLIENT_NAVIGATION_GROUPS.map(group => ({
    id: group.id,
    label: group[language] as string,
    items: items.filter(
      item =>
        (group.paths as readonly string[]).includes(item.path) ||
        (group.id === "more" &&
          !groupedPaths.has(item.path) &&
          !CLIENT_ACCOUNT_PATHS.includes(item.path) &&
          item.path !== "/notifications")
    ),
  }));
}

/** Regroup the already-authorized list without changing its visibility rules. */
export function groupAdminDestinations<T extends NavigationDestination>(
  items: T[],
  language: "ar" | "en"
) {
  const byPath = new Map(items.map(item => [item.path, item]));
  const assigned = new Set<string>();
  const groups = ADMIN_NAVIGATION_GROUPS.map(group => ({
    id: group.id as string,
    label: group[language] as string,
    items: group.paths.flatMap(path => {
      const item = byPath.get(path);
      if (!item) return [];
      assigned.add(path);
      return [item];
    }),
  })).filter(group => group.items.length > 0);
  const training = items.filter(item => item.path === "/courses");
  if (training.length) {
    groups.unshift({
      id: "training",
      label: language === "ar" ? "تدريب الموظفين" : "Employee Training",
      items: training,
    });
    assigned.add("/courses");
  }
  const remaining = items.filter(item => !assigned.has(item.path));
  if (remaining.length)
    groups.push({
      id: "other",
      label: language === "ar" ? "صفحات أخرى" : "Other pages",
      items: remaining,
    });
  return groups;
}

export function findActiveNavigationPath(
  items: NavigationDestination[],
  location: string
) {
  const pathname = location.split(/[?#]/)[0];
  return items
    .filter(
      item => pathname === item.path || pathname.startsWith(`${item.path}/`)
    )
    .sort((first, second) => second.path.length - first.path.length)[0]?.path;
}

export function matchNavigationQuery(
  item: NavigationDestination,
  query: string
) {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064b-\u065f]/g, "")
      .toLowerCase();
  return normalize(`${item.label} ${item.keywords ?? ""}`).includes(
    normalize(query.trim())
  );
}

export function readNavigationPreference(
  key: string,
  fallback: string[] = []
): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveNavigationPreference(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Navigation also works with storage disabled. */
  }
}
