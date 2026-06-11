import { Link } from 'wouter';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { RefundPolicyAr } from './RefundPolicyAr';
import { RefundPolicyEn } from './RefundPolicyEn';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

export default function RefundPolicy() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505] py-16 text-white md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="container mx-auto max-w-5xl px-4 md:px-8">
          <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm md:p-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 text-white/70 hover:bg-white/[0.06] hover:text-white">
                <ArrowLeft className={`h-4 w-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
                {isRtl ? 'الرئيسية' : 'Home'}
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C8A96B]/24 bg-[#C8A96B]/10">
                <RotateCcw className="h-7 w-7 text-[#C8A96B]" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-[-0.4px]">{isRtl ? 'سياسة الاشتراك والاسترجاع' : 'Subscription & Refund Policy'}</h1>
                <p className="mt-2 text-sm text-white/42">{isRtl ? 'آخر تحديث: يونيو 2026' : 'Last updated: June 2026'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#F6F3EC] p-6 text-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.24)] md:p-10">
            <div className="prose prose-zinc max-w-none space-y-6 text-sm leading-relaxed prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-900">
              {isRtl ? <RefundPolicyAr /> : <RefundPolicyEn />}
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}
