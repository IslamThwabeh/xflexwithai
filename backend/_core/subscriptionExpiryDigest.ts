export type SubscriptionExpiryDigestItem = {
  userId: number;
  email: string;
  name: string | null;
  daysLeft: number;
  stage: string;
  serviceType: "lexai" | "recommendations";
  serviceName: string;
  packageName: string;
  endDate: string;
};

export type SubscriptionExpiryDigestNotification = {
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  metadata: {
    total: number;
    expired: number;
    expiresToday: number;
    upcoming: number;
    subscriptions: Array<{
      userId: number;
      email: string;
      name: string | null;
      serviceType: "lexai" | "recommendations";
      serviceName: string;
      packageName: string;
      daysLeft: number;
      stage: string;
      endDate: string;
    }>;
  };
};

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatStatusEn(daysLeft: number) {
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return `expired ${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (daysLeft === 0) return "expires today";
  return `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

function formatStatusAr(daysLeft: number) {
  if (daysLeft < 0) return `منتهي منذ ${Math.abs(daysLeft)} يوم`;
  if (daysLeft === 0) return "ينتهي اليوم";
  return `ينتهي خلال ${daysLeft} يوم`;
}

function getDisplayName(item: SubscriptionExpiryDigestItem) {
  return item.name?.trim() || item.email;
}

function sortDigestItems(items: SubscriptionExpiryDigestItem[]) {
  return [...items].sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    const serviceCompare = a.serviceName.localeCompare(b.serviceName);
    if (serviceCompare !== 0) return serviceCompare;
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}

export function buildSubscriptionExpiryDigestNotification(
  items: SubscriptionExpiryDigestItem[],
): SubscriptionExpiryDigestNotification | null {
  if (items.length === 0) return null;

  const sortedItems = sortDigestItems(items);
  const expired = sortedItems.filter((item) => item.daysLeft < 0).length;
  const expiresToday = sortedItems.filter((item) => item.daysLeft === 0).length;
  const upcoming = sortedItems.length - expired - expiresToday;
  const summaryEn = `${expired} expired, ${expiresToday} expire today, ${upcoming} upcoming`;
  const summaryAr = `${expired} منتهي، ${expiresToday} ينتهي اليوم، ${upcoming} قادم`;

  const linesEn = sortedItems.map((item, index) => {
    const displayName = getDisplayName(item);
    return `${index + 1}. ${displayName} (${item.email}) - ${item.serviceName} - ${item.packageName} - ${formatStatusEn(item.daysLeft)} - ends ${formatDateOnly(item.endDate)}`;
  });
  const linesAr = sortedItems.map((item, index) => {
    const displayName = getDisplayName(item);
    return `${index + 1}. ${displayName} (${item.email}) - ${item.serviceName} - ${item.packageName} - ${formatStatusAr(item.daysLeft)} - ${formatDateOnly(item.endDate)}`;
  });

  return {
    titleEn: sortedItems.length === 1
      ? "1 subscription renewal needs attention"
      : `${sortedItems.length} subscription renewals need attention`,
    titleAr: sortedItems.length === 1
      ? "اشتراك واحد يحتاج متابعة تجديد"
      : `${sortedItems.length} اشتراكات تحتاج متابعة تجديد`,
    contentEn: `Subscription expiry digest: ${summaryEn}. ${linesEn.join(" | ")}`,
    contentAr: `ملخص انتهاء الاشتراكات: ${summaryAr}. ${linesAr.join(" | ")}`,
    metadata: {
      total: sortedItems.length,
      expired,
      expiresToday,
      upcoming,
      subscriptions: sortedItems.map((item) => ({
        userId: item.userId,
        email: item.email,
        name: item.name,
        serviceType: item.serviceType,
        serviceName: item.serviceName,
        packageName: item.packageName,
        daysLeft: item.daysLeft,
        stage: item.stage,
        endDate: item.endDate,
      })),
    },
  };
}
