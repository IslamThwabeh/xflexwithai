import { useState } from 'react';
import { Newspaper, Plus, Edit2, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminArticles() {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const { data: articles, isLoading } = trpc.articles.adminList.useQuery();
  const createMutation = trpc.articles.create.useMutation({ onSuccess: () => utils.articles.adminList.invalidate() });
  const updateMutation = trpc.articles.update.useMutation({ onSuccess: () => utils.articles.adminList.invalidate() });
  const deleteMutation = trpc.articles.delete.useMutation({ onSuccess: () => utils.articles.adminList.invalidate() });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      slug: '', titleEn: '', titleAr: '', contentEn: '', contentAr: '',
      excerptEn: '', excerptAr: '', thumbnailUrl: '', isPublished: 0,
      publishedAt: new Date().toISOString(),
    });
  };

  const startEdit = (article: any) => {
    setIsNew(false);
    setEditing({ ...article });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) {
      await createMutation.mutateAsync(editing);
    } else {
      await updateMutation.mutateAsync(editing);
    }
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await deleteMutation.mutateAsync({ id });
  };

  const togglePublish = async (article: any) => {
    await updateMutation.mutateAsync({
      id: article.id,
      isPublished: article.isPublished ? 0 : 1,
      publishedAt: article.isPublished ? undefined : new Date().toISOString(),
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'إدارة المقالات' : 'Manage Articles'}</h1>
          </div>
          <Button onClick={startNew} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'مقالة جديدة' : 'New Article'}
          </Button>
        </div>

        {/* Edit/Create Form */}
        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">
              {isNew ? (language === 'ar' ? 'مقالة جديدة' : 'New Article') : (language === 'ar' ? 'تعديل المقالة' : 'Edit Article')}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} dir="ltr" placeholder="my-article-title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'رابط الصورة' : 'Thumbnail URL'}</label>
                <Input value={editing.thumbnailUrl || ''} onChange={(e) => setEditing({ ...editing, thumbnailUrl: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (EN)</label>
                <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان (عربي)</label>
                <Input value={editing.titleAr} onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt (EN)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={editing.excerptEn || ''} onChange={(e) => setEditing({ ...editing, excerptEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المقتطف (عربي)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={editing.excerptAr || ''} onChange={(e) => setEditing({ ...editing, excerptAr: e.target.value })} dir="rtl" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Content (EN)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px]"
                  value={editing.contentEn || ''} onChange={(e) => setEditing({ ...editing, contentEn: e.target.value })} dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">المحتوى (عربي)</label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px]"
                  value={editing.contentAr || ''} onChange={(e) => setEditing({ ...editing, contentAr: e.target.value })} dir="rtl" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!editing.isPublished}
                  onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked ? 1 : 0 })} className="rounded" />
                {language === 'ar' ? 'منشور' : 'Published'}
              </label>
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

        {/* Articles List */}
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : articles?.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            {language === 'ar' ? 'لا توجد مقالات بعد' : 'No articles yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {articles?.map((article) => (
              <div key={article.id} className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{language === 'ar' ? article.titleAr : article.titleEn}</h3>
                    <Badge variant={article.isPublished ? 'default' : 'secondary'} className="text-xs">
                      {article.isPublished ? (language === 'ar' ? 'منشور' : 'Published') : (language === 'ar' ? 'مسودة' : 'Draft')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    /{article.slug}
                    {article.publishedAt && ` • ${new Date(article.publishedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(article)}>
                    {article.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(article)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(article.id)}>
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
