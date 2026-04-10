type RecommendationEmailLanguage = "ar" | "en";
type RecommendationMessageEmailType = "recommendation" | "update" | "result";

type RecommendationEmailTrade = {
  content: string;
  symbol?: string | null;
  side?: string | null;
  entryPrice?: string | null;
  stopLoss?: string | null;
  takeProfit1?: string | null;
  takeProfit2?: string | null;
  riskPercent?: string | null;
};

const RECOMMENDATIONS_URL = "https://xflexacademy.com/recommendations";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildRecommendationAlertEmail(input: {
  language: RecommendationEmailLanguage;
  unlockSeconds: number;
}) {
  const isArabic = input.language !== "en";
  const subject = isArabic
    ? "تنبيه التوصيات: جهّز تطبيق التداول، توصية جديدة قريبة"
    : "Recommendations alert: be ready, a new recommendation is coming";

  const title = isArabic ? "استعد للتوصية القادمة" : "Be ready for the next recommendation";
  const intro = isArabic
    ? `كن مستعداً، وابقَ داخل قناة التوصيات، وافتح تطبيق التداول. المحلل على وشك نشر توصية جديدة خلال حوالي ${input.unlockSeconds} ثانية.`
    : `Be prepared, stay inside the recommendations channel, and open your trading app. The analyst is about to post a new recommendation in about ${input.unlockSeconds} seconds.`;
  const bullets = isArabic
    ? [
        "ابقَ جاهزاً داخل حسابك حتى تتمكن من تنفيذ التوصية فور نشرها.",
        "افتح تطبيق التداول الآن حتى تكون مستعداً للدخول بسرعة.",
        "تابع التوصية الرئيسية ثم الردود القصيرة داخل نفس الصفقة.",
        "إذا صمت المحلل 15 دقيقة، سنرسل تنبيهاً جديداً قبل الرسالة التالية.",
      ]
    : [
        "Stay ready inside your account so you can act as soon as the recommendation is posted.",
        "Open your trading app now so you are ready to enter quickly.",
        "Follow the main recommendation first, then the short replies in the same trade thread.",
        "If the analyst stays silent for 15 minutes, we will send another alert before the next message.",
      ];
  const ctaLabel = isArabic ? "افتح القناة الآن" : "Open Channel Now";
  const footer = isArabic
    ? "تم إرسال هذا التنبيه لأن إشعارات التوصيات مفعلة على حسابك."
    : "You received this alert because recommendation notifications are enabled on your account.";
  const greeting = isArabic ? "تنبيه قروب التوصيات" : "Recommendations alert";

  const text = [
    `XFlex Academy - ${greeting}`,
    "--------------------------------",
    intro,
    "",
    ...bullets.map((bullet) => `- ${bullet}`),
    "",
    `${ctaLabel}: ${RECOMMENDATIONS_URL}`,
    "",
    footer,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f2;font-family:Arial,sans-serif;color:#10231d;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f7f2;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #d9eee7;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(16,35,29,0.08);">
          <tr>
            <td style="padding:24px 24px 18px;background:linear-gradient(135deg,#059669,#0f766e);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">XFlex Academy</div>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#1f2937;">${escapeHtml(intro)}</p>
              <div style="margin:0 0 22px;padding:16px 18px;border:1px solid #cdeee2;border-radius:14px;background:#f0fdf8;">
                <ul style="margin:0;padding:${isArabic ? "0 18px 0 0" : "0 0 0 18px"};color:#134e4a;font-size:14px;line-height:1.8;">
                  ${bullets.map((bullet) => `<li style="margin:0 0 8px;">${escapeHtml(bullet)}</li>`).join("")}
                </ul>
              </div>
              <div style="text-align:center;margin:0 0 20px;">
                <a href="${RECOMMENDATIONS_URL}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </div>
              <p style="margin:0;font-size:12px;line-height:1.7;color:#6b7280;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function buildTradeDetails(trade: RecommendationEmailTrade, isArabic: boolean) {
  return [
    trade.symbol ? { label: isArabic ? "الأصل / الزوج" : "Symbol / Pair", value: trade.symbol, tone: "default" as const } : null,
    trade.side ? { label: isArabic ? "الاتجاه" : "Direction", value: trade.side, tone: "default" as const } : null,
    trade.entryPrice ? { label: isArabic ? "الدخول" : "Entry", value: trade.entryPrice, tone: "default" as const } : null,
    trade.stopLoss ? { label: isArabic ? "وقف الخسارة" : "Stop Loss", value: trade.stopLoss, tone: "danger" as const } : null,
    trade.takeProfit1 ? { label: isArabic ? "هدف 1" : "Target 1", value: trade.takeProfit1, tone: "success" as const } : null,
    trade.takeProfit2 ? { label: isArabic ? "هدف 2" : "Target 2", value: trade.takeProfit2, tone: "success" as const } : null,
    trade.riskPercent ? { label: isArabic ? "نسبة المخاطرة" : "Risk", value: trade.riskPercent, tone: "default" as const } : null,
  ].filter((item): item is { label: string; value: string; tone: "default" | "danger" | "success" } => Boolean(item));
}

function getRecommendationMessageEmailSubject(input: {
  type: RecommendationMessageEmailType;
  trade: RecommendationEmailTrade;
  isArabic: boolean;
}) {
  const symbol = input.trade.symbol?.trim();
  const side = input.type === "recommendation" ? input.trade.side?.trim() : undefined;
  const suffix = [symbol, side].filter(Boolean).join(" ");

  if (input.type === "result") {
    return input.isArabic
      ? `نتيجة الصفقة${suffix ? `: ${suffix}` : ""}`
      : `Trade result${suffix ? `: ${suffix}` : ""}`;
  }

  if (input.type === "update") {
    return input.isArabic
      ? `تحديث على الصفقة${suffix ? `: ${suffix}` : ""}`
      : `Trade update${suffix ? `: ${suffix}` : ""}`;
  }

  return input.isArabic
    ? `التوصية الآن${suffix ? `: ${suffix}` : ""}`
    : `Recommendation now live${suffix ? `: ${suffix}` : ""}`;
}

export function buildRecommendationMessageEmail(input: {
  language: RecommendationEmailLanguage;
  type: RecommendationMessageEmailType;
  recommendation: RecommendationEmailTrade;
  latestMessage?: { content: string };
}) {
  const isArabic = input.language !== "en";
  const subject = getRecommendationMessageEmailSubject({
    type: input.type,
    trade: input.recommendation,
    isArabic,
  });
  const recommendationHeading = isArabic ? "التوصية الأساسية" : "Main recommendation";
  const latestHeading = input.type === "result"
    ? (isArabic ? "النتيجة الجديدة" : "Latest result")
    : (isArabic ? "آخر تحديث" : "Latest update");
  const intro = input.type === "recommendation"
    ? (isArabic
        ? "نُشرت التوصية الآن داخل قناة التوصيات. افتح القناة لمتابعة الصفقة بشكل مباشر."
        : "The recommendation is now live inside the recommendations channel. Open the channel to follow the trade directly.")
    : input.type === "result"
      ? (isArabic
          ? "تمت إضافة نتيجة جديدة على الصفقة نفسها. افتح القناة لمراجعة النتيجة الكاملة."
          : "A new result was added to the same trade. Open the channel to review the full outcome.")
      : (isArabic
          ? "هناك تحديث جديد على الصفقة نفسها. افتح القناة لمتابعة إدارة الصفقة مباشرة."
          : "There is a new update on the same trade. Open the channel to follow the trade management live.");
  const footer = isArabic
    ? "تم إرسال هذا التنبيه لأن إشعارات التوصيات مفعلة على حسابك عندما تكون خارج القناة."
    : "You received this alert because recommendation notifications are enabled on your account when you are away from the channel.";
  const ctaLabel = isArabic ? "افتح القناة الآن" : "Open Channel Now";
  const recommendationDetails = buildTradeDetails(input.recommendation, isArabic);
  const latestContent = input.type === "recommendation" ? "" : (input.latestMessage?.content?.trim() || "");

  const textLines = [
    `XFlex Academy - ${subject}`,
    "--------------------------------",
    intro,
    "",
    recommendationHeading,
    ...recommendationDetails.map((detail) => `${detail.label}: ${detail.value}`),
    input.recommendation.content,
  ];

  if (latestContent) {
    textLines.push("", latestHeading, latestContent);
  }

  textLines.push("", `${ctaLabel}: ${RECOMMENDATIONS_URL}`, "", footer);

  const detailGrid = recommendationDetails.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:0 0 18px;">${recommendationDetails.map((detail) => {
        const tone = detail.tone === "danger"
          ? "color:#dc2626;"
          : detail.tone === "success"
            ? "color:#059669;"
            : "color:#0f172a;";
        return `<div style="padding:12px 14px;border:1px solid #dbe4e1;border-radius:14px;background:#f8faf9;">
          <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${escapeHtml(detail.label)}</div>
          <div style="font-size:15px;font-weight:700;${tone}">${escapeHtml(detail.value)}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  const latestSection = latestContent
    ? `<div style="margin-top:18px;padding:18px;border:1px solid ${input.type === "result" ? "#bfe9db" : "#fde3b3"};border-radius:16px;background:${input.type === "result" ? "#ecfdf5" : "#fffbeb"};">
        <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${input.type === "result" ? "#0f766e" : "#b45309"};margin-bottom:10px;">
          ${escapeHtml(latestHeading)}
        </div>
        <div style="font-size:15px;line-height:1.8;color:#1f2937;white-space:pre-wrap;">${escapeHtml(latestContent)}</div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f2;font-family:Arial,sans-serif;color:#10231d;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f7f2;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:collapse;background:#ffffff;border:1px solid #d9eee7;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(16,35,29,0.08);">
          <tr>
            <td style="padding:24px 24px 18px;background:linear-gradient(135deg,#059669,#0f766e);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">XFlex Academy</div>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;">${escapeHtml(subject)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#1f2937;">${escapeHtml(intro)}</p>
              <div style="padding:20px;border:1px solid #cdeee2;border-radius:18px;background:#f8fffc;">
                <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e;margin-bottom:12px;">
                  ${escapeHtml(recommendationHeading)}
                </div>
                ${detailGrid}
                <div style="font-size:15px;line-height:1.85;color:#1f2937;white-space:pre-wrap;">${escapeHtml(input.recommendation.content)}</div>
                ${latestSection}
              </div>
              <div style="text-align:center;margin:22px 0 18px;">
                <a href="${RECOMMENDATIONS_URL}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </div>
              <p style="margin:0;font-size:12px;line-height:1.7;color:#6b7280;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
}