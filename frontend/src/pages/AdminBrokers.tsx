import { useState } from 'react';
import { Building2, Plus, Edit2, Trash2, Save, X, Eye, EyeOff, GripVertical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const empty = () => ({
  nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '',
  logoUrl: '', affiliateUrl: '', supportWhatsapp: '',
  minDeposit: 0, minDepositCurrency: 'USD',
  featuresEn: '', featuresAr: '',
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
    setEditing({ ...b });
  };

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      ...editing,
      minDeposit: Number(editing.minDeposit) || 0,
      displayOrder: Number(editing.displayOrder) || 0,
      logoUrl: editing.logoUrl?.trim() || undefined,
      descriptionEn: editing.descriptionEn?.trim() || undefined,
      descriptionAr: editing.descriptionAr?.trim() || undefined,
      supportWhatsapp: editing.supportWhatsapp?.trim() || undefined,
      featuresEn: editing.featuresEn?.trim() || undefined,
      featuresAr: editing.featuresAr?.trim() || undefined,
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

  const parseFeatures = (json: string | null | undefined): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  return (
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div />
          <Button onClick={startNew} className="gap-1.5">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الحد الأدنى للإيداع' : 'Min Deposit'}</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="w-28"
                    value={editing.minDeposit}
                    onChange={(e) => setEditing({ ...editing, minDeposit: Number(e.target.value) })}
                    min={0}
                  />
                  <Input
                    className="w-20"
                    value={editing.minDepositCurrency}
                    onChange={(e) => setEditing({ ...editing, minDepositCurrency: e.target.value })}
                    placeholder="USD"
                  />
                </div>
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

            <div className="flex gap-2 mt-5">
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
              return (
                <div key={b.id} className={`bg-white border rounded-xl p-5 transition-opacity ${!b.isActive ? 'opacity-60' : ''}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {b.logoUrl ? (
                        <img src={b.logoUrl} alt={b.nameEn} className="h-10 w-10 object-contain rounded" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-emerald-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-emerald-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-lg">{isRtl ? b.nameAr : b.nameEn}</h3>
                        <Badge variant={b.isActive ? 'default' : 'secondary'} className="text-xs">
                          {b.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">#{b.displayOrder}</span>
                  </div>

                  {/* Description */}
                  {(isRtl ? b.descriptionAr : b.descriptionEn) && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2" dir={isRtl ? 'rtl' : 'ltr'}>
                      {isRtl ? b.descriptionAr : b.descriptionEn}
                    </p>
                  )}

                  {/* Features */}
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {features.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Min Deposit */}
                  {b.minDeposit != null && b.minDeposit > 0 && (
                    <p className="text-sm text-gray-500 mb-3">
                      {isRtl ? 'الحد الأدنى: ' : 'Min Deposit: '}
                      <span className="font-semibold">${b.minDeposit} {b.minDepositCurrency}</span>
                    </p>
                  )}

                  {/* Affiliate Link */}
                  <a href={b.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mb-3">
                    <ExternalLink className="w-3 h-3" />
                    {isRtl ? 'رابط الأفلييت' : 'Affiliate Link'}
                  </a>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => startEdit(b)} className="gap-1 flex-1">
                      <Edit2 className="w-3.5 h-3.5" />
                      {isRtl ? 'تعديل' : 'Edit'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(b)} className="gap-1">
                      {b.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(b.id)} className="gap-1">
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
