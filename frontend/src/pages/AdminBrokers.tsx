import { useState } from 'react';
import { Building2, Plus, Edit2, Trash2, Save, X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSourceCurrencyAmount } from '@/lib/adminCurrency';
import { parseBrokerFeatures } from '@/lib/brokerFeatures';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const SUPPORTED_BROKER_CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'JOD', 'AED'] as const;

const empty = () => ({
  nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '',
  logoUrl: '', affiliateUrl: '', supportWhatsapp: '',
  minDeposit: 0, minDepositCurrency: 'USD',
  featuresEn: '', featuresAr: '',
  offerSummaryEn: '', offerSummaryAr: '',
  supportHoursEn: '', supportHoursAr: '',
  fundingMethodsEn: '', fundingMethodsAr: '',
  accountRequirementsEn: '', accountRequirementsAr: '',
  videoOpenAccount: '', videoVerify: '', videoDeposit: '',
  isActive: true, displayOrder: 0,
});

export default function AdminBrokers() {
  return (
    <DashboardLayout>
      <AdminBrokersContent />
    </DashboardLayout>
  );
}

export function AdminBrokersContent() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data: brokers, isLoading } = trpc.brokers.list.useQuery();
  const createMut = trpc.brokers.create.useMutation({
    onSuccess: () => { utils.brokers.list.invalidate(); setEditing(null); toast.success(isRtl ? 'تمت الإضافة' : 'Broker added'); },
  });
  const updateMut = trpc.brokers.update.useMutation({
    onSuccess: () => { utils.brokers.list.invalidate(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Broker updated'); },
  });
  const deleteMut = trpc.brokers.delete.useMutation({
    onSuccess: () => utils.brokers.list.invalidate(),
  });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => { setIsNew(true); setEditing(empty()); };
  const startEdit = (b: any) => {
    setIsNew(false);
    setEditing({
      ...b,
      minDeposit: Number(b.minDeposit) || 0,
      minDepositCurrency: (b.minDepositCurrency || 'USD').toUpperCase(),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      ...editing,
      minDeposit: Math.max(0, Math.round(Number(editing.minDeposit) || 0)),
      minDepositCurrency: (editing.minDepositCurrency || 'USD').toUpperCase(),
      displayOrder: Number(editing.displayOrder) || 0,
      logoUrl: editing.logoUrl?.trim() || undefined,
      descriptionEn: editing.descriptionEn?.trim() || undefined,
      descriptionAr: editing.descriptionAr?.trim() || undefined,
      supportWhatsapp: editing.supportWhatsapp?.trim() || undefined,
      featuresEn: editing.featuresEn?.trim() || undefined,
      featuresAr: editing.featuresAr?.trim() || undefined,
      offerSummaryEn: editing.offerSummaryEn?.trim() || undefined,
      offerSummaryAr: editing.offerSummaryAr?.trim() || undefined,
      supportHoursEn: editing.supportHoursEn?.trim() || undefined,
      supportHoursAr: editing.supportHoursAr?.trim() || undefined,
      fundingMethodsEn: editing.fundingMethodsEn?.trim() || undefined,
      fundingMethodsAr: editing.fundingMethodsAr?.trim() || undefined,
      accountRequirementsEn: editing.accountRequirementsEn?.trim() || undefined,
      accountRequirementsAr: editing.accountRequirementsAr?.trim() || undefined,
      videoOpenAccount: editing.videoOpenAccount?.trim() || undefined,
      videoVerify: editing.videoVerify?.trim() || undefined,
      videoDeposit: editing.videoDeposit?.trim() || undefined,
    };
    if (isNew) { await createMut.mutateAsync(payload); }
    else { await updateMut.mutateAsync(payload); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذا الوسيط؟' : 'Are you sure you want to delete this broker?')) return;
    await deleteMut.mutateAsync({ id });
  };

  const toggleActive = async (b: any) => {
    await updateMut.mutateAsync({ id: b.id, isActive: !b.isActive });
  };

  const parseFeatures = (json: string | null | undefined): string[] =>
    parseBrokerFeatures(json, { splitOnDash: true });

  return (
      <div className="min-w-0">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
          <Button onClick={startNew} className="max-w-full gap-1.5 whitespace-normal text-center">
            <Plus className="w-4 h-4" />
            {isRtl ? 'وسيط جديد' : 'New Broker'}
          </Button>
        </div>

        {/* Edit / Create Form */}
        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">
              {isNew ? (isRtl ? 'وسيط جديد' : 'New Broker') : (isRtl ? 'تعديل الوسيط' : 'Edit Broker')}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                <Input value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} dir="rtl" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[60px]"
                  value={editing.descriptionEn}
                  onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[60px]"
                  dir="rtl"
                  value={editing.descriptionAr}
                  onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'رابط الأفلييت' : 'Affiliate URL'} *</label>
                <Input
                  value={editing.affiliateUrl}
                  onChange={(e) => setEditing({ ...editing, affiliateUrl: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'رابط الشعار' : 'Logo URL'}</label>
                <Input
                  value={editing.logoUrl}
                  onChange={(e) => setEditing({ ...editing, logoUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'واتساب الدعم' : 'Support WhatsApp'}</label>
                <Input
                  value={editing.supportWhatsapp}
                  onChange={(e) => setEditing({ ...editing, supportWhatsapp: e.target.value })}
                  placeholder="+971..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'الحد الأدنى للإيداع' : 'Min Deposit'}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-32"
                    value={editing.minDeposit}
                    onChange={(e) => setEditing({ ...editing, minDeposit: Number(e.target.value) })}
                    min={0}
                  />
                  <select
                    className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-gray-700"
                    value={(editing.minDepositCurrency || 'USD').toUpperCase()}
                    onChange={(e) => setEditing({ ...editing, minDepositCurrency: e.target.value.toUpperCase() })}
                  >
                    {SUPPORTED_BROKER_CURRENCIES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {isRtl
                    ? 'يُعرض هذا المبلغ للطلاب بنفس العملة المختارة (عملة الوسيط الفعلية).'
                    : "Shown to students in the same currency you pick here (the broker's real source currency)."}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features (English) — {isRtl ? 'مفصولة بفاصلة' : 'comma-separated'}
                </label>
                <Input
                  value={Array.isArray(editing.featuresEn) ? '' : (editing._featuresEnText ?? parseFeatures(editing.featuresEn).join(', '))}
                  onChange={(e) => {
                    const text = e.target.value;
                    const arr = text.split(',').map((s: string) => s.trim()).filter(Boolean);
                    setEditing({ ...editing, featuresEn: JSON.stringify(arr), _featuresEnText: text });
                  }}
                  placeholder="Regulated, MT5 Support, Low Spreads"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'المميزات (عربي) — مفصولة بفاصلة' : 'Features (Arabic) — comma-separated'}
                </label>
                <Input
                  dir="rtl"
                  value={Array.isArray(editing.featuresAr) ? '' : (editing._featuresArText ?? parseFeatures(editing.featuresAr).join('، '))}
                  onChange={(e) => {
                    const text = e.target.value;
                    const arr = text.split(/[,،]/).map((s: string) => s.trim()).filter(Boolean);
                    setEditing({ ...editing, featuresAr: JSON.stringify(arr), _featuresArText: text });
                  }}
                  placeholder="مرخص، يدعم MT5، سبريد منخفض"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Offer Summary (English)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                  value={editing.offerSummaryEn}
                  onChange={(e) => setEditing({ ...editing, offerSummaryEn: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ملخص العرض (عربي)' : 'Offer Summary (Arabic)'}</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                  dir="rtl"
                  value={editing.offerSummaryAr}
                  onChange={(e) => setEditing({ ...editing, offerSummaryAr: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Support Hours (English)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[70px]"
                  value={editing.supportHoursEn}
                  onChange={(e) => setEditing({ ...editing, supportHoursEn: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ساعات الدعم (عربي)' : 'Support Hours (Arabic)'}</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[70px]"
                  dir="rtl"
                  value={editing.supportHoursAr}
                  onChange={(e) => setEditing({ ...editing, supportHoursAr: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Funding Methods (English)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[70px]"
                  value={editing.fundingMethodsEn}
                  onChange={(e) => setEditing({ ...editing, fundingMethodsEn: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'طرق التمويل (عربي)' : 'Funding Methods (Arabic)'}</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[70px]"
                  dir="rtl"
                  value={editing.fundingMethodsAr}
                  onChange={(e) => setEditing({ ...editing, fundingMethodsAr: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Requirements (English)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                  value={editing.accountRequirementsEn}
                  onChange={(e) => setEditing({ ...editing, accountRequirementsEn: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'متطلبات الحساب (عربي)' : 'Account Requirements (Arabic)'}</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                  dir="rtl"
                  value={editing.accountRequirementsAr}
                  onChange={(e) => setEditing({ ...editing, accountRequirementsAr: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Open Account Video URL</label>
                <Input
                  value={editing.videoOpenAccount}
                  onChange={(e) => setEditing({ ...editing, videoOpenAccount: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verify Video URL</label>
                <Input
                  value={editing.videoVerify}
                  onChange={(e) => setEditing({ ...editing, videoVerify: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Video URL</label>
                <Input
                  value={editing.videoDeposit}
                  onChange={(e) => setEditing({ ...editing, videoDeposit: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب العرض' : 'Display Order'}</label>
                <Input
                  type="number"
                  className="w-24"
                  value={editing.displayOrder}
                  onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <label className="text-sm font-medium text-gray-700">{isRtl ? 'نشط' : 'Active'}</label>
                <button
                  onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${editing.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${editing.isActive ? 'translate-x-5 ms-0.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Logo preview */}
            {editing.logoUrl && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'معاينة الشعار' : 'Logo Preview'}</label>
                <img src={editing.logoUrl} alt="logo" className="h-12 w-auto object-contain rounded border p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="gap-1.5">
                <Save className="w-4 h-4" />
                {isRtl ? 'حفظ' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
                <X className="w-4 h-4" />
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        {/* Broker Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : !brokers || brokers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'لا يوجد وسطاء بعد' : 'No brokers yet'}</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brokers.map((b) => {
              const features = parseFeatures(isRtl ? b.featuresAr : b.featuresEn);
              const logoNeedsDarkBg = /(?:^|[_\-/])white|vt-markets/i.test(b.logoUrl || '');
              return (
                <div key={b.id} className={`min-w-0 overflow-hidden bg-white border rounded-xl p-5 transition-opacity ${!b.isActive ? 'opacity-60' : ''}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {b.logoUrl ? (
                        <div className={`flex h-12 shrink-0 items-center justify-center rounded-md border px-3 py-1.5 ${logoNeedsDarkBg ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-white'}`}>
                          <img src={b.logoUrl} alt={b.nameEn} className="h-7 w-auto object-contain" style={{ maxWidth: '180px' }} />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-emerald-100">
                          <Building2 className="w-5 h-5 text-emerald-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-bold">{isRtl ? b.nameAr : b.nameEn}</h3>
                        <Badge variant={b.isActive ? 'default' : 'secondary'} className="text-xs">
                          {b.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">#{b.displayOrder}</span>
                  </div>

                  {/* Description */}
                  {(isRtl ? b.descriptionAr : b.descriptionEn) && (
                    <p className="mb-3 break-words text-sm text-gray-600 line-clamp-2" dir={isRtl ? 'rtl' : 'ltr'}>
                      {isRtl ? b.descriptionAr : b.descriptionEn}
                    </p>
                  )}

                  {/* Features */}
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {features.map((f, i) => (
                        <Badge key={i} variant="outline" className="h-auto max-w-full whitespace-normal break-words py-1 text-start text-xs leading-5">{f}</Badge>
                      ))}
                    </div>
                  )}

                  {(isRtl ? b.offerSummaryAr : b.offerSummaryEn) && (
                    <p className="mb-3 break-words text-sm text-amber-700" dir={isRtl ? 'rtl' : 'ltr'}>
                      {isRtl ? b.offerSummaryAr : b.offerSummaryEn}
                    </p>
                  )}

                  {/* Min Deposit */}
                  {b.minDeposit != null && b.minDeposit > 0 && (
                    <p className="text-sm text-gray-500 mb-3">
                      {isRtl ? 'الحد الأدنى: ' : 'Min Deposit: '}
                      <span className="font-semibold">{formatSourceCurrencyAmount(b.minDeposit, language, { currency: b.minDepositCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </p>
                  )}

                  {((isRtl ? b.supportHoursAr : b.supportHoursEn) || (isRtl ? b.fundingMethodsAr : b.fundingMethodsEn) || (isRtl ? b.accountRequirementsAr : b.accountRequirementsEn)) && (
                    <div className="space-y-2 mb-3 text-xs text-gray-600" dir={isRtl ? 'rtl' : 'ltr'}>
                      {(isRtl ? b.supportHoursAr : b.supportHoursEn) && (
                        <p className="break-words"><span className="font-semibold">{isRtl ? 'الدعم:' : 'Support:'}</span> {isRtl ? b.supportHoursAr : b.supportHoursEn}</p>
                      )}
                      {(isRtl ? b.fundingMethodsAr : b.fundingMethodsEn) && (
                        <p className="break-words"><span className="font-semibold">{isRtl ? 'التمويل:' : 'Funding:'}</span> {isRtl ? b.fundingMethodsAr : b.fundingMethodsEn}</p>
                      )}
                      {(isRtl ? b.accountRequirementsAr : b.accountRequirementsEn) && (
                        <p className="break-words"><span className="font-semibold">{isRtl ? 'ملاحظات:' : 'Notes:'}</span> {isRtl ? b.accountRequirementsAr : b.accountRequirementsEn}</p>
                      )}
                    </div>
                  )}

                  {(b.videoOpenAccount || b.videoVerify || b.videoDeposit) && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {b.videoOpenAccount && <Badge variant="secondary" className="text-xs">{isRtl ? 'فيديو فتح الحساب' : 'Open Video'}</Badge>}
                      {b.videoVerify && <Badge variant="secondary" className="text-xs">{isRtl ? 'فيديو التوثيق' : 'Verify Video'}</Badge>}
                      {b.videoDeposit && <Badge variant="secondary" className="text-xs">{isRtl ? 'فيديو الإيداع' : 'Deposit Video'}</Badge>}
                    </div>
                  )}

                  {/* Affiliate Link */}
                  <a href={b.affiliateUrl} target="_blank" rel="noopener noreferrer" className="mb-3 flex min-w-0 items-center gap-1 break-all text-xs text-emerald-600 hover:underline">
                    <ExternalLink className="w-3 h-3" />
                    {isRtl ? 'رابط الأفلييت' : 'Affiliate Link'}
                  </a>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t pt-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(b)} className="min-w-0 flex-1 gap-1">
                      <Edit2 className="w-3.5 h-3.5" />
                      {isRtl ? 'تعديل' : 'Edit'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(b)} className="shrink-0 gap-1">
                      {b.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(b.id)} className="shrink-0 gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
