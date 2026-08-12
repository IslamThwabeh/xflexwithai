import type {
  TimedServiceActivationReason,
  TimedServiceReminderStage,
} from "./timed-service-activation.service";

export type TimedServiceName = "LexAI" | "Recommendations";

export type TimedServiceWindow = {
  name: TimedServiceName;
  startDate: string;
  endDate: string;
};

function formatDateTime(value: string, locale: "ar" | "en") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(parsed);
}

function serviceLabel(name: TimedServiceName, locale: "ar" | "en") {
  if (name === "Recommendations") return locale === "ar" ? "التوصيات" : "Recommendations";
  return "LexAI";
}

export function buildTimedServiceReminderContent(input: {
  clientName?: string | null;
  services: TimedServiceName[];
  deadline: string;
  stage: TimedServiceReminderStage;
}) {
  const days = input.stage === "three_days" ? 3 : 1;
  const namesAr = input.services.map((name) => serviceLabel(name, "ar")).join(" + ");
  const namesEn = input.services.map((name) => serviceLabel(name, "en")).join(" + ");
  const deadlineAr = formatDateTime(input.deadline, "ar");
  const deadlineEn = formatDateTime(input.deadline, "en");
  const greetingAr = input.clientName ? `مرحباً ${input.clientName}،` : "مرحباً،";
  const greetingEn = input.clientName ? `Hello ${input.clientName},` : "Hello,";
  const titleAr = days === 1
    ? "تذكير: سيتم تفعيل خدماتك خلال 24 ساعة"
    : "تذكير: سيتم تفعيل خدماتك خلال 3 أيام";
  const titleEn = days === 1
    ? "Reminder: your services activate within 24 hours"
    : "Reminder: your services activate in 3 days";
  const contentAr = `سيتم تفعيل ${namesAr} تلقائياً في ${deadlineAr}. يمكنك متابعة متطلبات الدورة والوسيط من حسابك، ولا يلزم اتخاذ إجراء لإتمام التفعيل التلقائي.`;
  const contentEn = `${namesEn} will activate automatically on ${deadlineEn}. You can continue the course and broker requirements from your account; no action is required for automatic activation.`;

  return {
    titleAr,
    titleEn,
    contentAr,
    contentEn,
    subject: `[XFlex Trading Academy] ${titleAr} | ${titleEn}`,
    text: [greetingAr, contentAr, "", greetingEn, contentEn].join("\n"),
    deadlineAr,
    deadlineEn,
    namesAr,
    namesEn,
  };
}

export function buildTimedServiceActivationContent(input: {
  clientName?: string | null;
  activationReason: TimedServiceActivationReason;
  courseWaivedByPolicy: boolean;
  brokerWaivedByPolicy: boolean;
  services: TimedServiceWindow[];
}) {
  const policyActivated = input.activationReason === "protection_expired";
  const reasonAr = policyActivated
    ? "انتهت فترة الحماية وتم تفعيل الخدمة تلقائياً حسب السياسة."
    : "تم استكمال متطلبات بدء الخدمة.";
  const reasonEn = policyActivated
    ? "The protection period ended and the service was activated automatically under the policy."
    : "The service activation requirements were completed.";
  const waiverAr = [
    input.courseWaivedByPolicy ? "تم تجاوز شرط الدورة حسب السياسة." : null,
    input.brokerWaivedByPolicy ? "تم تجاوز شرط الوسيط حسب السياسة." : null,
  ].filter(Boolean).join(" ");
  const waiverEn = [
    input.courseWaivedByPolicy ? "The course gate was waived by policy." : null,
    input.brokerWaivedByPolicy ? "The broker gate was waived by policy." : null,
  ].filter(Boolean).join(" ");
  const rows = input.services.map((service) => ({
    ...service,
    nameAr: serviceLabel(service.name, "ar"),
    nameEn: serviceLabel(service.name, "en"),
    startAr: formatDateTime(service.startDate, "ar"),
    startEn: formatDateTime(service.startDate, "en"),
    endAr: formatDateTime(service.endDate, "ar"),
    endEn: formatDateTime(service.endDate, "en"),
  }));
  const detailsAr = rows.map((row) => `${row.nameAr}: من ${row.startAr} حتى ${row.endAr}`).join("؛ ");
  const detailsEn = rows.map((row) => `${row.nameEn}: ${row.startEn} to ${row.endEn}`).join("; ");

  return {
    reasonAr,
    reasonEn,
    waiverAr,
    waiverEn,
    detailsAr,
    detailsEn,
    rows,
  };
}
