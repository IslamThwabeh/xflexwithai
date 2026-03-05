import { useState } from 'react';
import { MessageSquareQuote, Plus, Edit2, Trash2, Save, X, Star, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const empty = () => ({
  nameEn: '', nameAr: '', titleEn: '', titleAr: '', textEn: '', textAr: '',
  avatarUrl: '', rating: 5, displayOrder: 0, isPublished: true,
});

export default function AdminTestimonials() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data: testimonials, isLoading } = trpc.testimonials.adminList.useQuery();
  const createMut = trpc.testimonials.create.useMutation({ onSuccess: () => { utils.testimonials.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تمت الإضافة' : 'Added'); } });
  const updateMut = trpc.testimonials.update.useMutation({ onSuccess: () => { utils.testimonials.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Updated'); } });
  const deleteMut = trpc.testimonials.delete.useMutation({ onSuccess: () => utils.testimonials.adminList.invalidate() });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => { setIsNew(true); setEditing(empty()); };
  const startEdit = (t: any) => { setIsNew(false); setEditing({ ...t }); };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) { await createMut.mutateAsync(editing); }
    else { await updateMut.mutateAsync(editing); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await deleteMut.mutateAsync({ id });
  };

  const togglePublish = async (t: any) => {
    await updateMut.mutateAsync({ id: t.id, isPublished: !t.isPublished });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <MessageSquareQuote className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{isRtl ? 'إدارة الشهادات' : 'Manage Testimonials'}</h1>
          </div>
          <Button onClick={startNew} className="gap-1.5"><Plus className="w-4 h-4" />{isRtl ? 'شهادة جديدة' : 'New Testimonial'}</Button>
        </div>

        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">{isNew ? (isRtl ? 'شهادة جديدة' : 'New Testimonial') : (isRtl ? 'تعديل الشهادة' : 'Edit Testimonial')}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                <Input value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (English)</label>
                <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} placeholder="e.g. Forex Trader" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                <Input value={editing.titleAr} onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })} dir="rtl" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Testimonial Text (English)</label>
                <textarea className="w-full border rounded-md p-2 text-sm min-h-[80px]" value={editing.textEn} onChange={(e) => setEditing({ ...editing, textEn: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'نص الشهادة (عربي)' : 'Testimonial Text (Arabic)'}</label>
                <textarea className="w-full border rounded-md p-2 text-sm min-h-[80px]" dir="rtl" value={editing.textAr} onChange={(e) => setEditing({ ...editing, textAr: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'رابط الصورة' : 'Avatar URL'}</label>
                <Input value={editing.avatarUrl} onChange={(e) => setEditing({ ...editing, avatarUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'التقييم' : 'Rating'}</label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setEditing({ ...editing, rating: n })} className="p-0.5">
                      <Star className={`w-5 h-5 ${n <= editing.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب العرض' : 'Display Order'}</label>
                <Input type="number" value={editing.displayOrder} onChange={(e) => setEditing({ ...editing, displayOrder: +e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} />
                <label className="text-sm">{isRtl ? 'منشورة' : 'Published'}</label>
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
        ) : !testimonials || testimonials.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'لا توجد شهادات' : 'No testimonials yet'}</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {(isRtl ? t.nameAr : t.nameEn).charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{isRtl ? t.nameAr : t.nameEn}</p>
                      <p className="text-xs text-gray-500">{isRtl ? t.titleAr : t.titleEn}</p>
                    </div>
                  </div>
                  <Badge variant={t.isPublished ? 'default' : 'secondary'} className="text-xs">
                    {t.isPublished ? (isRtl ? 'منشورة' : 'Published') : (isRtl ? 'مسودة' : 'Draft')}
                  </Badge>
                </div>
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <p className="text-sm text-gray-600 line-clamp-3 mb-3">"{isRtl ? t.textAr : t.textEn}"</p>
                <div className="flex gap-1.5 border-t pt-3">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(t)}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => togglePublish(t)}>{t.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
