export type InactivityDigestService = {
  serviceType: "lexai" | "recommendations";
  serviceName: string;
  status: "active" | "expired";
  endDate: string;
  daysLeft: number;
};

export type InactivityDigestItem = {
  userId: number;
  email: string;
  name: string | null;
  inactiveDays: number;
  services: InactivityDigestService[];
  deliveryStatus: "sent" | "skipped" | "failed";
};

function escapeHtml(input: string | number | null | undefined) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatServiceSummary(services: InactivityDigestService[]) {
  return services
    .map(service => `${service.serviceName}: ${service.status}`)
    .join(" · ");
}

function formatDeliveryStatus(status: InactivityDigestItem["deliveryStatus"]) {
  if (status === "sent") return "Sent + admin BCC";
  if (status === "skipped") return "Skipped by email preference/suppression";
  return "Failed — will retry";
}

export function buildInactivityDigestNotification(
  items: InactivityDigestItem[]
) {
  if (items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) =>
      b.inactiveDays - a.inactiveDays ||
      (a.name?.trim() || a.email).localeCompare(b.name?.trim() || b.email)
  );
  const sent = sorted.filter(item => item.deliveryStatus === "sent").length;
  const skipped = sorted.filter(
    item => item.deliveryStatus === "skipped"
  ).length;
  const failed = sorted.filter(item => item.deliveryStatus === "failed").length;
  const activeServiceCount = sorted
    .flatMap(item => item.services)
    .filter(service => service.status === "active").length;
  const expiredServiceCount = sorted
    .flatMap(item => item.services)
    .filter(service => service.status === "expired").length;

  const rows = sorted
    .map(item => {
      const displayName = item.name?.trim() || item.email;
      const deliveryColor =
        item.deliveryStatus === "sent"
          ? "#047857"
          : item.deliveryStatus === "failed"
            ? "#b91c1c"
            : "#6b7280";
      return `
      <tr>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;">
          <strong style="color:#111827;">${escapeHtml(displayName)}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${escapeHtml(item.email)}</span>
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:#374151;">
          ${escapeHtml(item.inactiveDays)} days
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:#374151;">
          ${escapeHtml(formatServiceSummary(item.services))}
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;color:${deliveryColor};">
          ${escapeHtml(formatDeliveryStatus(item.deliveryStatus))}
        </td>
      </tr>`;
    })
    .join("");

  const contentEn = [
    `Inactive-client outreach processed for ${sorted.length} client${sorted.length === 1 ? "" : "s"}.`,
    `${sent} sent with admin BCC, ${skipped} skipped, ${failed} failed.`,
    `${activeServiceCount} active timed service${activeServiceCount === 1 ? "" : "s"} and ${expiredServiceCount} expired timed service${expiredServiceCount === 1 ? "" : "s"}.`,
  ].join(" ");

  return {
    titleEn: `Inactivity outreach: ${sorted.length} client${sorted.length === 1 ? "" : "s"}`,
    titleAr: `متابعة عدم النشاط: ${sorted.length} عميل`,
    contentEn,
    contentAr: `تمت معالجة رسائل عدم النشاط لـ ${sorted.length} عميل. تم إرسال ${sent}، وتخطي ${skipped}، وفشل ${failed}.`,
    emailContentHtmlEn: `
      <p style="margin:0 0 14px;color:#374151;line-height:1.6;">${escapeHtml(contentEn)}</p>
      <div style="overflow-x:auto;">
        <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;color:#374151;">
              <th align="left" style="padding:9px 8px;">Client</th>
              <th align="left" style="padding:9px 8px;">Inactive</th>
              <th align="left" style="padding:9px 8px;">Timed services</th>
              <th align="left" style="padding:9px 8px;">Delivery</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
    metadata: {
      totalClients: sorted.length,
      sent,
      skipped,
      failed,
      activeServiceCount,
      expiredServiceCount,
      clients: sorted,
    },
  };
}
