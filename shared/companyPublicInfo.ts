/** Owner-approved public copy. Update the ministry name here when the licence arrives. */
export const COMPANY_PUBLIC_INFO = {
  ar: {
    statement: 'تقع شركة XFlex في رام الله – البالوع، وهي مرخّصة لدى وزارة التجارة.',
    office: 'مجمع قطوم التجاري، الطابق الرابع، البالوع — الزيارات متاحة بموعد مسبق فقط.',
    installments: 'الدفع بالتقسيط متاح عبر بطاقة إيزي لايف',
    announcement: 'جديد لدى XFlex — الدفع بالتقسيط متاح الآن عبر بطاقة إيزي لايف',
    installmentDetails: 'تواصل معنا لمعرفة تفاصيل التقسيط وآلية الدفع.',
    installmentAction: 'استفسر عن التقسيط',
    installmentMessage: 'مرحباً، أود الاستفسار عن الدفع بالتقسيط عبر بطاقة إيزي لايف، والباقات المشمولة وآلية الدفع.',
  },
  en: {
    statement: 'XFlex is based in Ramallah – Al-Balou and is licensed by the Ministry of Trade.',
    office: 'Qattoum Commercial Complex, fourth floor, Al-Balou — visits by appointment only.',
    installments: 'Installment payments are available with the Easy Life card',
    announcement: 'New at XFlex — installment payments are now available with the Easy Life card',
    installmentDetails: 'Contact our team for installment details and payment arrangements.',
    installmentAction: 'Ask about installments',
    installmentMessage: 'Hello, I would like to ask about Easy Life card installments, eligible packages, and payment arrangements.',
  },
} as const;

export function getEasyLifeInquiryHref(language: 'ar' | 'en') {
  return `https://wa.me/972597596030?text=${encodeURIComponent(COMPANY_PUBLIC_INFO[language].installmentMessage)}`;
}
