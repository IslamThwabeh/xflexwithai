import { useState, type ChangeEvent } from 'react';
import { MessageSquareQuote, Plus, Edit2, Trash2, Save, X, Star, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const empty = () => ({
  nameEn: '', nameAr: '', titleEn: '', titleAr: '', textEn: '', textAr: '',
  avatarUrl: '', proofImageUrl: '', rating: 5, packageSlug: '', courseId: undefined as number | undefined, serviceKey: '', displayOrder: 0, showProofOnHome: false, showProofOnDashboard: false, isPublished: true,
});

export default function AdminTestimonials() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const invalidateTestimonials = () => {
    utils.testimonials.adminList.invalidate();
    utils.testimonials.list.invalidate();
    utils.testimonials.listWithContext.invalidate();
    utils.testimonials.listProofs.invalidate();
  };
  const { data: testimonials, isLoading } = trpc.testimonials.adminList.useQuery();
  const { data: packages } = trpc.packages.adminList.useQuery();
  const { data: courses } = trpc.courses.listAll.useQuery();
  const createMut = trpc.testimonials.create.useMutation({ onSuccess: () => { invalidateTestimonials(); setEditing(null); toast.success(isRtl ? 'تمت الإضافة' : 'Added'); } });
  const updateMut = trpc.testimonials.update.useMutation({ onSuccess: () => { invalidateTestimonials(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Updated'); } });
  const deleteMut = trpc.testimonials.delete.useMutation({ onSuccess: () => invalidateTestimonials() });
  const uploadProofImage = trpc.testimonials.uploadProofImage.useMutation();

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => { setIsNew(true); setEditing(empty()); };
  const startEdit = (t: any) => { setIsNew(false); setEditing({ ...t }); };

  const handleSave = async () => {
    if (!editing) return;
    const proofImageUrl = editing.proofImageUrl?.trim() || undefined;
    const payload = {
      ...editing,
      avatarUrl: editing.avatarUrl?.trim() || undefined,
      proofImageUrl,
      packageSlug: editing.packageSlug?.trim() || undefined,
      serviceKey: editing.serviceKey?.trim() || undefined,
      courseId: editing.courseId ? Number(editing.courseId) : undefined,
      showProofOnHome: Boolean(proofImageUrl && editing.showProofOnHome),
      showProofOnDashboard: Boolean(proofImageUrl && editing.showProofOnDashboard),
    };
    if (isNew) { await createMut.mutateAsync(payload); }
    else { await updateMut.mutateAsync(payload); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await deleteMut.mutateAsync({ id });
  };

  const togglePublish = async (t: any) => {
    await updateMut.mutateAsync({ id: t.id, isPublished: !t.isPublished });
  };

  const handleProofUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (!base64) {
        toast.error(isRtl ? 'فشل في قراءة الملف' : 'Failed to read file');
        return;
      }

      try {
        const result = await uploadProofImage.mutateAsync({
          fileName: file.name,
          fileData: base64,
          contentType: file.type,
        });
        setEditing({
          ...editing,
          proofImageUrl: result.url,
          showProofOnHome: editing.showProofOnHome || true,
        });
        toast.success(isRtl ? 'تم رفع صورة الإثبات' : 'Proof image uploaded');
      } catch (error: any) {
        toast.error(error.message || (isRtl ? 'فشل في رفع الصورة' : 'Upload failed'));
      }
    };
    reader.onerror = () => toast.error(isRtl ? 'فشل في قراءة الملف' : 'Failed to read file');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <MessageSquareQuote className="w-6 h-6 text-emerald-600" />
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
              <div className="md:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'صورة إثبات للشهادة' : 'Proof image for testimonial'}</label>
                    <p className="text-xs text-gray-500">
                      {isRtl ? 'ارفع لقطة شاشة مناسبة للعرض على الصفحة الرئيسية أو لوحة الطالب.' : 'Upload a polished screenshot for the homepage or student dashboard.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                      <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                      {uploadProofImage.isPending ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{isRtl ? 'جارٍ الرفع...' : 'Uploading...'}</span>
                      ) : (
                        <span>{isRtl ? 'رفع صورة' : 'Upload image'}</span>
                      )}
                    </label>
                    {editing.proofImageUrl ? (
                      <Button type="button" variant="outline" onClick={() => setEditing({ ...editing, proofImageUrl: '', showProofOnHome: false, showProofOnDashboard: false })}>
                        {isRtl ? 'إزالة' : 'Remove'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {editing.proofImageUrl ? (
                  <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                    <div className="overflow-hidden rounded-xl border bg-slate-950 p-2">
                      <img src={editing.proofImageUrl} alt="" className="w-full aspect-[9/15] object-contain object-center rounded-lg" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          id="show-proof-home"
                          type="checkbox"
                          checked={editing.showProofOnHome}
                          onChange={(e) => setEditing({ ...editing, showProofOnHome: e.target.checked })}
                        />
                        <label htmlFor="show-proof-home" className="text-sm text-gray-700">{isRtl ? 'إظهار في قسم الإثباتات بالصفحة الرئيسية' : 'Show in homepage proof gallery'}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="show-proof-dashboard"
                          type="checkbox"
                          checked={editing.showProofOnDashboard}
                          onChange={(e) => setEditing({ ...editing, showProofOnDashboard: e.target.checked })}
                        />
                        <label htmlFor="show-proof-dashboard" className="text-sm text-gray-700">{isRtl ? 'إظهار في لوحة الطالب' : 'Show on student dashboard'}</label>
                      </div>
                      <p className="text-xs text-gray-500">
                        {isRtl ? 'استخدم لقطات مرتبة وواضحة فقط. الصور التي تحتوي على شريط الصور أو لوحة المفاتيح أو قصّ غير متوازن يجب تنظيفها قبل النشر.' : 'Use only clean, balanced screenshots. Images with camera-roll strips, keyboards, or awkward framing should be cleaned before publishing.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{isRtl ? 'لا توجد صورة إثبات مرفوعة بعد.' : 'No proof image uploaded yet.'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الباقة المرتبطة (اختياري)' : 'Linked Package (optional)'}</label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={editing.packageSlug || ''}
                  onChange={(e) => setEditing({ ...editing, packageSlug: e.target.value || '' })}
                >
                  <option value="">{isRtl ? 'الكل / عام' : 'All / Generic'}</option>
                  {packages?.map((pkg) => (
                    <option key={pkg.id} value={pkg.slug}>{isRtl ? pkg.nameAr : pkg.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الدورة المرتبطة (اختياري)' : 'Linked Course (optional)'}</label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={editing.courseId || ''}
                  onChange={(e) => setEditing({ ...editing, courseId: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">{isRtl ? 'الكل / عام' : 'All / Generic'}</option>
                  {courses?.map((course: any) => (
                    <option key={course.id} value={course.id}>{isRtl ? course.titleAr : course.titleEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الخدمة المرتبطة (اختياري)' : 'Linked Service (optional)'}</label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={editing.serviceKey || ''}
                  onChange={(e) => setEditing({ ...editing, serviceKey: e.target.value || '' })}
                >
                  <option value="">{isRtl ? 'الكل / عام' : 'All / Generic'}</option>
                  <option value="courses">{isRtl ? 'الدورات' : 'Courses'}</option>
                  <option value="lexai">LexAI</option>
                  <option value="recommendations">{isRtl ? 'التوصيات' : 'Recommendations'}</option>
                  <option value="community">{isRtl ? 'المجتمع' : 'Community'}</option>
                </select>
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
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
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
                {t.proofImageUrl ? (
                  <div className="mb-3 overflow-hidden rounded-xl border bg-slate-950 p-2">
                    <img src={t.proofImageUrl} alt="" className="w-full aspect-[9/15] object-contain object-center rounded-lg" />
                  </div>
                ) : null}
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.packageSlug && <Badge variant="outline" className="text-[10px]">{isRtl ? 'باقة' : 'Package'}: {t.packageSlug}</Badge>}
                  {t.courseId && <Badge variant="outline" className="text-[10px]">{isRtl ? 'دورة' : 'Course'} #{t.courseId}</Badge>}
                  {t.serviceKey && <Badge variant="outline" className="text-[10px]">{isRtl ? 'خدمة' : 'Service'}: {t.serviceKey}</Badge>}
                  {t.showProofOnHome ? <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">{isRtl ? 'إثبات الرئيسية' : 'Home Proof'}</Badge> : null}
                  {t.showProofOnDashboard ? <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700">{isRtl ? 'إثبات الطالب' : 'Dashboard Proof'}</Badge> : null}
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
