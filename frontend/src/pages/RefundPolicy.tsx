import { Link } from 'wouter';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { RefundPolicyAr } from './RefundPolicyAr';
import { RefundPolicyEn } from './RefundPolicyEn';

export default function RefundPolicy() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {isRtl ? 'الرئيسية' : 'Home'}
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-extrabold">{isRtl ? 'سياسة الاشتراك والاسترجاع' : 'Subscription & Refund Policy'}</h1>
          </div>
          <p className="text-sm text-gray-400 mt-2">{isRtl ? 'آخر تحديث: مارس 2026' : 'Last updated: March 2026'}</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="prose prose-gray max-w-none leading-relaxed space-y-6 text-sm text-gray-700">
          {isRtl ? <RefundPolicyAr /> : <RefundPolicyEn />}
        </div>
      </div>
    </div>
  );
}
