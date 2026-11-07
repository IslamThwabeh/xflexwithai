import { ArrowUpRight, CreditCard } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { COMPANY_PUBLIC_INFO, getEasyLifeInquiryHref } from '@shared/companyPublicInfo';

type Props = {
  variant?: 'card' | 'footer' | 'banner';
  appearance?: 'dark' | 'light';
  className?: string;
};

export default function EasyLifeNotice({ variant = 'card', appearance = 'dark', className = '' }: Props) {
  const { language, isRTL } = useLanguage();
  const copy = COMPANY_PUBLIC_INFO[language];
  const inquiryHref = getEasyLifeInquiryHref(language);
  const linkClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500';

  if (variant === 'banner') {
    return (
      <aside aria-label={copy.installments} dir={isRTL ? 'rtl' : 'ltr'} className={`border-b border-[#00C176]/25 bg-[#08251c] ${className}`}>
        <div className="container mx-auto flex flex-col items-center justify-center gap-2 px-4 py-3 text-center sm:flex-row sm:gap-5 md:px-8">
          <p className="text-xs font-semibold leading-6 text-white sm:text-sm">{copy.announcement}</p>
          <a href={inquiryHref} target="_blank" rel="noopener noreferrer" className={`${linkClass} shrink-0 bg-[#00C176]/15 px-3 py-2 text-xs text-[#9ff0ce]`}>
            {copy.installmentAction}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </a>
        </div>
      </aside>
    );
  }

  if (variant === 'footer') {
    return (
      <div className={`text-xs leading-6 text-white/65 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <p>{copy.installments}</p>
        <a href={inquiryHref} target="_blank" rel="noopener noreferrer" className={`${linkClass} mt-1 text-[#78e0b7]`}>
          {copy.installmentAction}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  const light = appearance === 'light';
  return (
    <aside aria-label={copy.installments} dir={isRTL ? 'rtl' : 'ltr'} className={`rounded-2xl border p-4 ${light ? 'border-emerald-200 bg-emerald-50 text-slate-900' : 'border-[#00C176]/25 bg-[#08251c] text-white'} ${className}`}>
      <div className="flex items-start gap-3">
        <CreditCard aria-hidden="true" className={`mt-1 h-5 w-5 shrink-0 ${light ? 'text-emerald-700' : 'text-[#78e0b7]'}`} />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-6">{copy.installments}</p>
          <p className={`mt-1 text-xs leading-6 ${light ? 'text-slate-600' : 'text-white/70'}`}>{copy.installmentDetails}</p>
          <a href={inquiryHref} target="_blank" rel="noopener noreferrer" className={`${linkClass} mt-2 py-1 text-xs ${light ? 'text-emerald-800' : 'text-[#78e0b7]'}`}>
            {copy.installmentAction}<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}
