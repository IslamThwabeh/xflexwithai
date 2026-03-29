import { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, Save, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const empty = () => ({
  code: '', discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: 10, maxUses: undefined as number | undefined,
  minOrderAmount: undefined as number | undefined,
  validFrom: '', validUntil: '', isActive: true, packageId: undefined as number | undefined,
});

export default function AdminCoupons() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data: coupons, isLoading } = trpc.coupons.adminList.useQuery();
  const createMut = trpc.coupons.create.useMutation({ onSuccess: () => { utils.coupons.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تم إنشاء الكوبون' : 'Coupon created'); } });
  const updateMut = trpc.coupons.update.useMutation({ onSuccess: () => { utils.coupons.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Updated'); } });
  const deleteMut = trpc.coupons.delete.useMutation({ onSuccess: () => utils.coupons.adminList.invalidate() });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const startNew = () => { setIsNew(true); setEditing(empty()); };
  const startEdit = (c: any) => { setIsNew(false); setEditing({ ...c, discountValue: c.discountType === 'fixed' ? c.discountValue / 100 : c.discountValue, minOrderAmount: c.minOrderAmount ? c.minOrderAmount / 100 : undefined }); };

  const handleSave = async () => {
    if (!editing) return;
    const data = {
      ...editing,
      discountValue: editing.discountType === 'fixed' ? Math.round(editing.discountValue * 100) : editing.discountValue,
      minOrderAmount: editing.minOrderAmount ? Math.round(editing.minOrderAmount * 100) : undefined,
      validFrom: editing.validFrom || undefined,
      validUntil: editing.validUntil || undefined,
    };
    if (isNew) { await createMut.mutateAsync(data); }
    else { await updateMut.mutateAsync(data); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await deleteMut.mutateAsync({ id });
  };

  const copyCode = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">{isRtl ? 'إدارة كوبونات الخصم' : 'Manage Coupons'}</h1>
          </div>
          <Button onClick={startNew} className="gap-1.5"><Plus className="w-4 h-4" />{isRtl ? 'كوبون جديد' : 'New Coupon'}</Button>
        </div>

        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">{isNew ? (isRtl ? 'كوبون جديد' : 'New Coupon') : (isRtl ? 'تعديل الكوبون' : 'Edit Coupon')}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الكود' : 'Code'}</label>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="SUMMER2024" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'نوع الخصم' : 'Discount Type'}</label>
                <select className="w-full border rounded-md h-10 px-3" value={editing.discountType} onChange={(e) => setEditing({ ...editing, discountType: e.target.value })}>
                  <option value="percentage">{isRtl ? 'نسبة مئوية (%)' : 'Percentage (%)'}</option>
                  <option value="fixed">{isRtl ? 'مبلغ ثابت ($)' : 'Fixed Amount ($)'}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'قيمة الخصم' : 'Discount Value'}</label>
                <Input type="number" min={1} value={editing.discountValue} onChange={(e) => setEditing({ ...editing, discountValue: +e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الحد الأقصى للاستخدام' : 'Max Uses'}</label>
                <Input type="number" value={editing.maxUses ?? ''} onChange={(e) => setEditing({ ...editing, maxUses: e.target.value ? +e.target.value : undefined })} placeholder={isRtl ? 'غير محدود' : 'Unlimited'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الحد الأدنى للطلب ($)' : 'Min Order Amount ($)'}</label>
                <Input type="number" value={editing.minOrderAmount ?? ''} onChange={(e) => setEditing({ ...editing, minOrderAmount: e.target.value ? +e.target.value : undefined })} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'صالح من' : 'Valid From'}</label>
                <Input type="date" value={editing.validFrom?.slice(0, 10) || ''} onChange={(e) => setEditing({ ...editing, validFrom: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'صالح حتى' : 'Valid Until'}</label>
                <Input type="date" value={editing.validUntil?.slice(0, 10) || ''} onChange={(e) => setEditing({ ...editing, validUntil: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                <label className="text-sm">{isRtl ? 'مفعّل' : 'Active'}</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="gap-1.5"><Save className="w-4 h-4" />{isRtl ? 'حفظ' : 'Save'}</Button>
              <Button variant="outline" onClick={() => setEditing(null)} className="gap-1.5"><X className="w-4 h-4" />{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : !coupons || coupons.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'لا توجد كوبونات' : 'No coupons yet'}</div>
        ) : (
          <div className="overflow-x-auto bg-white border rounded-xl">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الخصم' : 'Discount'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الاستخدام' : 'Usage'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الصلاحية' : 'Validity'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">{c.code}</code>
                        <button onClick={() => copyCode(c.code, c.id)} className="text-gray-400 hover:text-gray-600">
                          {copied === c.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">{c.discountType === 'percentage' ? `${c.discountValue}%` : `$${(c.discountValue / 100).toFixed(2)}`}</td>
                    <td className="p-3">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                    <td className="p-3 text-xs">
                      {c.validFrom && <div>{isRtl ? 'من:' : 'From:'} {new Date(c.validFrom).toLocaleDateString()}</div>}
                      {c.validUntil && <div>{isRtl ? 'حتى:' : 'Until:'} {new Date(c.validUntil).toLocaleDateString()}</div>}
                      {!c.validFrom && !c.validUntil && <span className="text-gray-400">{isRtl ? 'دائم' : 'No limit'}</span>}
                    </td>
                    <td className="p-3"><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? (isRtl ? 'مفعل' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}</Badge></td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
