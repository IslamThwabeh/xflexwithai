import { Link } from 'wouter';
import { ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { formatIlsAmount, getPackageDisplayPricing, getUpgradeDisplayPricing } from '@/lib/packagePricing';
import { useAuth } from '@/_core/hooks/useAuth';

/** All customer entry points use the same server-side eligibility decision. */
export default function UpgradeCallout({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { data: eligibility } = trpc.upgrade.checkEligibility.useQuery(undefined, { enabled: !!user, retry: false });
  if (!eligibility) return null;
  const isUpgrade = eligibility.isUpgrade !== false;
  const button = <Link href={eligibility.pendingOrderId ? `/orders/${eligibility.pendingOrderId}` : isUpgrade ? '/upgrade' : '/checkout/comprehensive'}><Button className="mt-3">{eligibility.pendingOrderId ? (isRtl ? 'عرض الطلب' : 'View Order') : isUpgrade ? (isRtl ? 'إنشاء طلب ترقية' : 'Create Upgrade Order') : (isRtl ? 'شراء الباقة الشاملة' : 'Buy Comprehensive')}</Button></Link>;
  if (compact) return button;
  const pricing = isUpgrade
    ? getUpgradeDisplayPricing(eligibility.currentPackageSlug, 'comprehensive', eligibility.upgradePrice)
    : getPackageDisplayPricing('comprehensive', eligibility.purchasePrice, null, eligibility.currency);

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
        <ArrowUpCircle className="h-5 w-5 shrink-0" />
        {isUpgrade ? (isRtl ? 'ترقية إلى الباقة الشاملة' : 'Upgrade to Comprehensive') : (isRtl ? 'أضف الباقة الشاملة إلى بكج لايف' : 'Add Comprehensive alongside Live Package')}
      </h2>
      <p className="mt-2 text-sm leading-7 text-emerald-800">
        {eligibility.pendingOrderId
          ? (isRtl ? 'طلبك موجود بالفعل. افتحه لرفع إيصال الدفع أو متابعة مراجعة الدعم واستلام مفتاح التفعيل.' : 'Your order already exists. Open it to upload payment proof, follow the support review, or collect your activation key.')
          : isRtl
          ? `احصل على LexAI والتوصيات مقابل ${formatIlsAmount(pricing.ilsPrice)} لمرة واحدة. إذا دفعت بالفعل، أنشئ طلبك وارفع إيصالك لمراجعة الدعم وإصدار مفتاح التفعيل.`
          : `Get LexAI and recommendations for ${formatIlsAmount(pricing.ilsPrice)} once. Already paid? Create your order and upload your receipt so support can review it and issue your activation key.`}
      </p>
      {!isUpgrade && <p className="mt-2 text-sm leading-7 text-emerald-800">{isRtl ? 'هذا شراء للباقة الشاملة بالكامل. يبقى بكج لايف متاحاً بشكل مستقل.' : 'This is a full Comprehensive purchase. Your Live Package stays available separately.'}</p>}
      {button}
    </section>
  );
}
