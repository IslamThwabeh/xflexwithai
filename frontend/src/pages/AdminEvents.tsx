import { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminEvents() {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.adminList.useQuery();
  const createMutation = trpc.events.create.useMutation({ onSuccess: () => utils.events.adminList.invalidate() });
  const updateMutation = trpc.events.update.useMutation({ onSuccess: () => utils.events.adminList.invalidate() });
  const deleteMutation = trpc.events.delete.useMutation({ onSuccess: () => utils.events.adminList.invalidate() });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '',
      eventType: 'live', eventDate: new Date().toISOString().split('T')[0],
      eventEndDate: '', imageUrl: '', linkUrl: '', isPublished: 0,
    });
  };

  const startEdit = (event: any) => {
    setIsNew(false);
    setEditing({ ...event, eventDate: event.eventDate?.split('T')[0] || event.eventDate });
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

  const togglePublish = async (event: any) => {
    await updateMutation.mutateAsync({ id: event.id, isPublished: event.isPublished ? 0 : 1 });
  };

  const typeOptions = [
    { value: 'live', label: language === 'ar' ? 'بث مباشر' : 'Live Session' },
    { value: 'competition', label: language === 'ar' ? 'مسابقة' : 'Competition' },
    { value: 'discount', label: language === 'ar' ? 'عرض خاص' : 'Special Offer' },
    { value: 'webinar', label: language === 'ar' ? 'ندوة' : 'Webinar' },
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الأحداث' : 'Manage Events'}</h1>
          </div>
          <Button onClick={startNew} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'حدث جديد' : 'New Event'}
          </Button>
        </div>

        {/* Edit/Create Form */}
        {editing && (
          <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">
              {isNew ? (language === 'ar' ? 'حدث جديد' : 'New Event') : (language === 'ar' ? 'تعديل الحدث' : 'Edit Event')}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (EN)</label>
                <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان (عربي)</label>
                <Input value={editing.titleAr} onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })} dir="rtl" />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'النوع' : 'Type'}</label>
                <select className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.eventType} onChange={(e) => setEditing({ ...editing, eventType: e.target.value })}>
                  {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                <Input type="date" value={editing.eventDate || ''} onChange={(e) => setEditing({ ...editing, eventDate: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'رابط الصورة' : 'Image URL'}</label>
                <Input value={editing.imageUrl || ''} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'رابط الحدث' : 'Link URL'}</label>
                <Input value={editing.linkUrl || ''} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} dir="ltr" />
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

        {/* Events List */}
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : events?.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            {language === 'ar' ? 'لا توجد أحداث بعد' : 'No events yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {events?.map((event) => (
              <div key={event.id} className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{language === 'ar' ? event.titleAr : event.titleEn}</h3>
                    <Badge variant={event.isPublished ? 'default' : 'secondary'} className="text-xs">
                      {event.isPublished ? (language === 'ar' ? 'منشور' : 'Published') : (language === 'ar' ? 'مسودة' : 'Draft')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(event)}>
                    {event.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(event)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(event.id)}>
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
