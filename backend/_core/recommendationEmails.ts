type RecommendationEmailLanguage = "ar" | "en";

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