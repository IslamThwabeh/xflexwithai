export type LivePackageOwnerReviewQuestion = {
  id: string;
  text: string;
  hint: string;
};

export const LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS: LivePackageOwnerReviewQuestion[] = [
  { id: "package_names", text: "ما الاسم النهائي المعتمد للبكج بالعربية والإنجليزية؟", hint: "الاقتراح الحالي: بكج لايف / Live Package" },
  { id: "marketing_copy", text: "ما النص التسويقي النهائي الذي تريدين ظهوره بالعربية والإنجليزية؟", hint: "اكتبي النصين أو وافقي على النص المقترح." },
  { id: "sales_dates", text: "ما تاريخ ووقت بدء وانتهاء البيع؟", hint: "يرجى تحديد التوقيت؛ ستعرض المنصة الأوقات بتوقيت عمّان." },
  { id: "live_dates", text: "ما تاريخ بداية ونهاية فترة اللقاءات المباشرة؟", hint: "يمكن تعديل جدول كل لقاء لاحقاً من لوحة الإدارة." },
  { id: "price_vat", text: "هل السعر النهائي ₪2,000 شامل ضريبة القيمة المضافة؟", hint: "اكتبي موافقة صريحة أو السعر/المعاملة الضريبية الصحيحة." },
  { id: "package_inclusions", text: "هل تعتمدين محتويات البكج: لقاءان أسبوعياً بمدة تقارب ساعة، الدورات الأساسية المختارة، والتسجيلات المحمية؟", hint: "اذكري أي تعديل مطلوب." },
  { id: "recording_policy", text: "هل يبقى الوصول إلى التسجيلات دائماً أم ينتهي في تاريخ محدد؟", hint: "إذا كان محدداً، اكتبي التاريخ والوقت." },
  { id: "business_address", text: "ما عنوان العمل الدقيق المسموح بنشره؟", hint: "اكتبي العنوان أو «غير مسموح بالنشر»." },
  { id: "refund_terms", text: "ما سياسة الاسترجاع الخاصة بهذا البكج المباشر؟", hint: "نحتاج صياغة واضحة قبل فتح الشراء." },
  { id: "launch_approval", text: "هل تعتمدين عبارة ما قبل الإطلاق، وهل تعطين الموافقة النهائية على التفعيل بعد مراجعة المعاينة؟", hint: "الاقتراح: «ترقبوا الحدث الأضخم هالسنة». هذه الإجابة لا تفعّل البكج تلقائياً." },
];

export const LIVE_PACKAGE_OWNER_REVIEW_QUESTION_IDS = new Set(
  LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.map(question => question.id),
);

export const LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS = LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.map(
  question => question.id,
);
