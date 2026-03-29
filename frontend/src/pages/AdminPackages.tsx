import { useState } from 'react';
import { Package, Plus, Edit2, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminPackages() {
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const { data: packages, isLoading } = trpc.packages.adminList.useQuery();
  const createMutation = trpc.packages.create.useMutation({ onSuccess: () => utils.packages.adminList.invalidate() });
  const updateMutation = trpc.packages.update.useMutation({ onSuccess: () => utils.packages.adminList.invalidate() });
  const deleteMutation = trpc.packages.delete.useMutation({ onSuccess: () => utils.packages.adminList.invalidate() });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      slug: '', nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '',
      price: 0, currency: 'USD', renewalPrice: 0, renewalPeriodDays: 30, renewalDescription: '',
      includesLexai: 0, includesRecommendations: 0, includesSupport: 0, includesPdf: 0,
      isLifetime: 1, isPublished: 0, displayOrder: 0, upgradePrice: 0,
    });
    // Note: for new packages, price is entered in $ and converted to cents on save
  };

  const startEdit = (pkg: any) => {
    setIsNew(false);
    // Convert cents → dollars for display
    setEditing({
      ...pkg,
      price: (pkg.price || 0) / 100,
      renewalPrice: (pkg.renewalPrice || 0) / 100,
      upgradePrice: (pkg.upgradePrice || 0) / 100,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    // Convert dollars → cents for storage
    const toSave = {
      ...editing,
      price: Math.round((editing.price || 0) * 100),
      renewalPrice: Math.round((editing.renewalPrice || 0) * 100),
      upgradePrice: Math.round((editing.upgradePrice || 0) * 100),
    };
    if (isNew) {
      await createMutation.mutateAsync(toSave);
    } else {
      await updateMutation.mutateAsync(toSave);
    }
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await deleteMutation.mutateAsync({ id });
  };

  const togglePublish = async (pkg: any) => {
    await updateMutation.mutateAsync({ id: pkg.id, isPublished: pkg.isPublished ? 0 : 1 });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الباقات' : 'Manage Packages'}</h1>
          </div>
          <Button onClick={startNew} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'باقة جديدة' : 'New Package'}
          </Button>
        </div>

        {/* Edit/Create Form */}
        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">
              {isNew ? (language === 'ar' ? 'باقة جديدة' : 'New Package') : (language === 'ar' ? 'تعديل الباقة' : 'Edit Package')}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="basic" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم (عربي)</label>
                <Input value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'السعر ($)' : 'Price ($)'}</label>
                <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (EN)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={editing.descriptionEn || ''} onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف (عربي)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={editing.descriptionAr || ''} onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'سعر التجديد ($)' : 'Renewal Price ($)'}</label>
                <Input type="number" value={editing.renewalPrice || 0} onChange={(e) => setEditing({ ...editing, renewalPrice: Number(e.target.value) })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <Input type="number" value={editing.displayOrder || 0} onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'سعر الترقية ($)' : 'Upgrade Price ($)'}</label>
                <Input type="number" value={editing.upgradePrice || 0} onChange={(e) => setEditing({ ...editing, upgradePrice: Number(e.target.value) })} dir="ltr" />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-4 mt-4">
              {[
                { key: 'includesLexai', label: 'LexAI' },
                { key: 'includesRecommendations', label: language === 'ar' ? 'التوصيات' : 'Recommendations' },
                { key: 'includesSupport', label: language === 'ar' ? 'الدعم' : 'Support' },
                { key: 'includesPdf', label: 'PDF' },
                { key: 'isLifetime', label: language === 'ar' ? 'مدى الحياة' : 'Lifetime' },
                { key: 'isPublished', label: language === 'ar' ? 'منشور' : 'Published' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editing[key]}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.checked ? 1 : 0 })}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="w-4 h-4" />
                {language === 'ar' ? 'حفظ' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                <X className="w-4 h-4" />
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        {/* Packages List */}
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div className="space-y-3">
            {packages?.map((pkg) => (
              <div key={pkg.id} className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{language === 'ar' ? pkg.nameAr : pkg.nameEn}</h3>
                    <Badge variant={pkg.isPublished ? 'default' : 'secondary'} className="text-xs">
                      {pkg.isPublished ? (language === 'ar' ? 'منشور' : 'Published') : (language === 'ar' ? 'مسودة' : 'Draft')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    ${(pkg.price / 100).toFixed(0)} • {pkg.slug}
                    {pkg.includesLexai ? ' • LexAI' : ''}
                    {pkg.includesRecommendations ? (language === 'ar' ? ' • توصيات' : ' • Rec') : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(pkg)} title={pkg.isPublished ? 'Unpublish' : 'Publish'}>
                    {pkg.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(pkg)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(pkg.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
