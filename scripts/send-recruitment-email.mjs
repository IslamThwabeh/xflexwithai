/**
 * One-time script: send recruitment interview invitation to doaa.thwabeh@gmail.com
 * Usage (PowerShell):
 *   $env:ZEPTOMAIL_TOKEN = "your-zeptomail-api-key"
 *   node scripts/send-recruitment-email.mjs
 */

const token = process.env.ZEPTOMAIL_TOKEN;
if (!token) {
  console.error("ERROR: ZEPTOMAIL_TOKEN environment variable is not set.");
  process.exit(1);
}

const rawToken = String(token).trim();
const authHeader = /^zoho-enczapikey\b/i.test(rawToken)
  ? rawToken
  : `Zoho-enczapikey ${rawToken}`;

const to = "doaa.thwabeh@gmail.com";
const from = "support@xflexacademy.com";
const fromName = "أكاديمية XFlex";
const subject = "دعوة للمقابلة الوظيفية – وظيفة المبيعات | أكاديمية XFlex";

const textBody = `مرحبًا،

نبارك لك اختيارك للانتقال إلى المرحلة التالية من عملية التوظيف لوظيفة المبيعات في أكاديمية XFlex. يسعدنا اهتمامك بالانضمام إلى فريقنا، ونتطلع للتعرّف عليك بشكل أكبر خلال المقابلة.

يرجى العلم أنه من الضروري الرد على هذا البريد الإلكتروني لتأكيد اهتمامك بالاستمرار في عملية التوظيف، حتى نتمكن من تزويدك بتفاصيل موعد وتاريخ وموقع المقابلة الوجاهية.

في حال عدم الرد خلال ٤٨ ساعة، لن يتم تحديد موعد للمقابلة ويُلغى ترشيحك تمامًا من فريقنا.

بانتظار ردك في أقرب وقت.

مع تمنياتنا لك بالتوفيق،
فريق أكاديمية XFlex`;

const htmlBody = `<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.8; color: #222;">
  <p>مرحبًا،</p>
  <p>
    نبارك لك اختيارك للانتقال إلى المرحلة التالية من عملية التوظيف لوظيفة المبيعات في أكاديمية XFlex.
    يسعدنا اهتمامك بالانضمام إلى فريقنا، ونتطلع للتعرّف عليك بشكل أكبر خلال المقابلة.
  </p>
  <p>
    يرجى العلم أنه من الضروري <strong>الرد على هذا البريد الإلكتروني</strong> لتأكيد اهتمامك بالاستمرار في عملية التوظيف،
    حتى نتمكن من تزويدك بتفاصيل موعد وتاريخ وموقع المقابلة الوجاهية.
  </p>
  <p style="color: #c0392b;">
    في حال عدم الرد خلال <strong>٤٨ ساعة</strong>، لن يتم تحديد موعد للمقابلة ويُلغى ترشيحك تمامًا من فريقنا.
  </p>
  <p>بانتظار ردك في أقرب وقت.</p>
  <br/>
  <p>مع تمنياتنا لك بالتوفيق،<br/><strong>فريق أكاديمية XFlex</strong></p>
</div>`;

const payload = {
  from: { address: from, name: fromName },
  to: [{ email_address: { address: to } }],
  subject,
  textbody: textBody,
  htmlbody: htmlBody,
};

console.log(`Sending email to: ${to}`);
console.log(`Subject: ${subject}`);

const res = await fetch("https://api.zeptomail.com/v1.1/email", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: authHeader,
  },
  body: JSON.stringify(payload),
});

const body = await res.text();

if (res.ok) {
  console.log("✓ Email sent successfully.");
  console.log("Response:", body);
} else {
  console.error(`✗ Failed to send email. Status: ${res.status}`);
  console.error("Response:", body);
  process.exit(1);
}
