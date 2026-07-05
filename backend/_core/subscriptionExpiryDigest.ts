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
  emailContentHtmlEn: string;
  metadata: {
    total: number;
    totalServices: number;
    totalClients: number;
    totalRows: number;
    expired: number;
    expiredServices: number;
    expiresToday: number;
    expiresTodayServices: number;
    upcoming: number;
    upcomingServices: number;
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

type SubscriptionExpiryDigestRow = {
  userId: number;
  email: string;
  name: string | null;
  packageName: string;
  daysLeft: number;
  stage: string;
  endDate: string;
  services: Array<"LexAI" | "Recommendations" | string>;
};

function escapeHtml(input: string | number | null | undefined) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    const nameCompare = getDisplayName(a).localeCompare(getDisplayName(b));
    if (nameCompare !== 0) return nameCompare;
    const endCompare = formatDateOnly(a.endDate).localeCompare(formatDateOnly(b.endDate));
    if (endCompare !== 0) return endCompare;
    return a.serviceName.localeCompare(b.serviceName);
  });
}

function getClientKey(item: SubscriptionExpiryDigestItem) {
  return `${item.userId}:${item.email.toLowerCase()}`;
}

function groupDigestRows(items: SubscriptionExpiryDigestItem[]): SubscriptionExpiryDigestRow[] {
  const grouped = new Map<string, SubscriptionExpiryDigestRow>();
  for (const item of sortDigestItems(items)) {
    const key = [
      getClientKey(item),
      item.packageName,
      formatDateOnly(item.endDate),
      item.daysLeft,
    ].join("|");
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.services.includes(item.serviceName)) {
        existing.services.push(item.serviceName);
      }
      continue;
    }
    grouped.set(key, {
      userId: item.userId,
      email: item.email,
      name: item.name,
      packageName: item.packageName,
      daysLeft: item.daysLeft,
      stage: item.stage,
      endDate: item.endDate,
      services: [item.serviceName],
    });
  }
  return [...grouped.values()];
}

function formatCount(noun: string, count: number) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatServiceCount(count: number) {
  return formatCount("service", count);
}

function formatEnglishServiceSummary(input: {
  expiredServices: number;
  expiresTodayServices: number;
  upcomingServices: number;
}) {
  const expiresTodayVerb = input.expiresTodayServices === 1 ? "expires" : "expire";
  return `${formatServiceCount(input.expiredServices)} expired, ${formatServiceCount(input.expiresTodayServices)} ${expiresTodayVerb} today, ${formatServiceCount(input.upcomingServices)} upcoming`;
}

function buildDigestEmailHtml(input: {
  rows: SubscriptionExpiryDigestRow[];
  totalServices: number;
  totalClients: number;
  expiredServices: number;
  expiresTodayServices: number;
  upcomingServices: number;
}) {
  const summary = `${formatCount("client", input.totalClients)} / ${formatCount("service", input.totalServices)} need attention`;
  const statusSummary = formatEnglishServiceSummary(input);
  const rowHtml = input.rows.map((row) => {
    const displayName = row.name?.trim() || row.email;
    const services = row.services.join(" + ");
    const statusColor = row.daysLeft < 0 ? "#dc2626" : row.daysLeft === 0 ? "#f59e0b" : "#047857";
    return `
      <tr>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;">
          <strong style="color:#111827;">${escapeHtml(displayName)}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${escapeHtml(row.email)}</span>
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:#374151;">
          ${escapeHtml(services)}<br/>
          <span style="color:#6b7280;font-size:12px;">${escapeHtml(row.packageName)}</span>
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:${statusColor};font-weight:bold;">
          ${escapeHtml(formatStatusEn(row.daysLeft))}
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:#374151;white-space:nowrap;">
          ${escapeHtml(formatDateOnly(row.endDate))}
        </td>
      </tr>`;
  }).join("");

  return `
    <p style="margin:0 0 14px;color:#374151;line-height:1.6;">
      ${escapeHtml(summary)}. ${escapeHtml(statusSummary)}.
    </p>
    <div style="overflow-x:auto;">
      <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;color:#374151;">
            <th align="left" style="padding:9px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.02em;">Client</th>
            <th align="left" style="padding:9px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.02em;">Services</th>
            <th align="left" style="padding:9px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.02em;">Status</th>
            <th align="left" style="padding:9px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.02em;">Ends</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">
      Comprehensive packages can include both LexAI and Recommendations. They are grouped here under one client row when they share the same end date.
    </p>`;
}

export function buildSubscriptionExpiryDigestNotification(
  items: SubscriptionExpiryDigestItem[],
): SubscriptionExpiryDigestNotification | null {
  if (items.length === 0) return null;

  const sortedItems = sortDigestItems(items);
  const rows = groupDigestRows(sortedItems);
  const clientCount = new Set(sortedItems.map(getClientKey)).size;
  const expiredServices = sortedItems.filter((item) => item.daysLeft < 0).length;
  const expiresTodayServices = sortedItems.filter((item) => item.daysLeft === 0).length;
  const upcomingServices = sortedItems.length - expiredServices - expiresTodayServices;
  const summaryEn = `${formatEnglishServiceSummary({ expiredServices, expiresTodayServices, upcomingServices })} across ${formatCount("client", clientCount)}`;
  const summaryAr = `${expiredServices} خدمات منتهية، ${expiresTodayServices} تنتهي اليوم، ${upcomingServices} قادمة لدى ${clientCount} عميل`;

  const linesEn = rows.map((row, index) => {
    const displayName = row.name?.trim() || row.email;
    return `${index + 1}. ${displayName} (${row.email}) - ${row.services.join(" + ")} - ${row.packageName} - ${formatStatusEn(row.daysLeft)} - ends ${formatDateOnly(row.endDate)}`;
  });
  const linesAr = rows.map((row, index) => {
    const displayName = row.name?.trim() || row.email;
    return `${index + 1}. ${displayName} (${row.email}) - ${row.services.join(" + ")} - ${row.packageName} - ${formatStatusAr(row.daysLeft)} - ${formatDateOnly(row.endDate)}`;
  });

  return {
    titleEn: `${formatCount("client", clientCount)} / ${formatCount("service", sortedItems.length)} need attention`,
    titleAr: `${clientCount} عميل / ${sortedItems.length} خدمة تحتاج متابعة`,
    contentEn: `Subscription expiry digest: ${summaryEn}. ${linesEn.join(" | ")}`,
    contentAr: `ملخص انتهاء الاشتراكات: ${summaryAr}. ${linesAr.join(" | ")}`,
    emailContentHtmlEn: buildDigestEmailHtml({
      rows,
      totalServices: sortedItems.length,
      totalClients: clientCount,
      expiredServices,
      expiresTodayServices,
      upcomingServices,
    }),
    metadata: {
      total: sortedItems.length,
      totalServices: sortedItems.length,
      totalClients: clientCount,
      totalRows: rows.length,
      expired: expiredServices,
      expiredServices,
      expiresToday: expiresTodayServices,
      expiresTodayServices,
      upcoming: upcomingServices,
      upcomingServices,
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
