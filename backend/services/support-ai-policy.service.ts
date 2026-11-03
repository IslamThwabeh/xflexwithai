export function mentionsVtMarkets(content: string): boolean {
  return /(?:\bvt\s*markets?\b|في\s*تي\s*ماركت|7447512|dOwr0sLk)/i.test(content);
}

export function isAcademyAccountRecoveryRequest(content: string): boolean {
  const text = content.toLowerCase().replace(/[أإآ]/g, "ا");
  const academy = /(?:academy|course|اكاديمي|الدورة|الدوره|الموقع)/i.test(text);
  if (mentionsVtMarkets(text) && !academy) return false;
  const email = /(?:e-?mail|بريد|ايميل)/i.test(text);
  const changingOrLost = /(?:\b(?:change|update|replace|lost|deleted?|recover)\b|تغيير|اغير|غيرت|تبديل|بدل|حذف|فقد|استرجاع|استعيد)/i.test(text);
  const oldAndNew = /(?:\bold\b|قديم)/i.test(text) && /(?:\bnew\b|جديد)/i.test(text);
  const accountRecovery = /(?:recover\s+(?:my\s+)?account|استرجاع\s+حساب|استعيد\s+حساب)/i.test(text);
  return (email && (changingOrLost || oldAndNew)) || accountRecovery;
}

export function getSensitiveSupportReview(intent: string, isArabic: boolean) {
  if (intent === "account_change") return {
    escalationReason: "account_change" as const,
    answer: isArabic
      ? "طلب تغيير البريد أو استعادة الحساب يحتاج مراجعة فريق الدعم. سيتابع الفريق معك هنا مع الحفاظ على اشتراكك وتقدّمك. لا ترسل كلمة المرور أو رموز الدخول في المحادثة."
      : "Changing an email or recovering an account needs review by the support team. The team will continue with you here and review how to preserve your access and progress. Do not share passwords or login codes in chat.",
  };
  if (intent === "security") return {
    escalationReason: "security" as const,
    answer: isArabic
      ? "هذا الطلب يحتاج مراجعة فريق الدعم لحماية حسابك. سيتابع الفريق معك هنا؛ لا ترسل كلمة المرور أو رموز الدخول في المحادثة."
      : "The support team needs to review this request to protect your account. They will continue with you here; do not share passwords or login codes in chat.",
  };
  if (intent === "billing_or_refund") return {
    escalationReason: "billing_or_refund" as const,
    answer: isArabic
      ? "طلب الدفع أو الاسترداد يحتاج مراجعة فريق الدعم لسجل الطلب. سيتابع الفريق معك هنا لتوضيح الحالة والخطوة التالية بعد التحقق."
      : "The support team needs to review the order record for this payment or refund request. They will continue with you here and confirm the status and next step after checking it.",
  };
  return null;
}
