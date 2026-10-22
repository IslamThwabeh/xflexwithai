import { Link } from 'wouter';
import { ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { formatIlsAmount, getUpgradeDisplayPricing } from '@/lib/packagePricing';
import { useAuth } from '@/_core/hooks/useAuth';

/** All customer entry points use the same server-side eligibility decision. */
export default function UpgradeCallout({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { data: eligibility } = trpc.upgrade.checkEligibility.useQuery(undefined, { enabled: !!user, retry: false });
  if (!eligibility) return null;
  const button = <Link href={eligibility.pendingOrderId ? `/orders/${eligibility.pendingOrderId}` : '/upgrade'}><Button className="mt-3">{eligibility.pendingOrderId ? (isRtl ? 'عرض طلب الترقية' : 'View Upgrade Order') : (isRtl ? 'إنشاء طلب ترقية' : 'Create Upgrade Order')}</Button></Link>;
  if (compact) return button;
  const pricing = getUpgradeDisplayPricing(eligibility.currentPackageSlug, 'comprehensive', eligibility.upgradePrice);

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
        <ArrowUpCircle className="h-5 w-5 shrink-0" />
        {isRtl ? 'ترقية إلى الباقة الشاملة' : 'Upgrade to Comprehensive'}
      </h2>
      <p className="mt-2 text-sm leading-7 text-emerald-800">
        {isRtl
          ? `أضف LexAI والتوصيات مقابل ${formatIlsAmount(pricing.ilsPrice)} لمرة واحدة. إذا دفعت بالفعل، أنشئ طلب الترقية وارفع إيصالك لمراجعة الدعم وإصدار مفتاح التفعيل.`
          : `Add LexAI and recommendations for ${formatIlsAmount(pricing.ilsPrice)} once. Already paid? Create your upgrade order and upload your receipt so support can review it and issue your activation key.`}
      </p>
      {button}
    </section>
  );
}
