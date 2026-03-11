import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminNotifications() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [showSend, setShowSend] = useState(false);
  const [form, setForm] = useState({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', type: 'info' as string, actionUrl: '' });

  const { data: recentNotifications, isLoading } = trpc.notifications.list.useQuery();

  const { data: allUsers } = trpc.users.list.useQuery();

  const sendMut = trpc.notifications.send.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إرسال الإشعار' : 'Notification sent');
      setShowSend(false);
      setForm({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', type: 'info', actionUrl: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-500" />
            {isRtl ? 'مركز الإشعارات' : 'Notification Center'}
          </h1>
          <Button onClick={() => setShowSend(!showSend)}>
            <Send className="w-4 h-4 me-2" />
            {isRtl ? 'إرسال إشعار جماعي' : 'Send Bulk Notification'}
          </Button>
        </div>

        {/* Send Form */}
        {showSend && (
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              {isRtl ? 'إرسال إشعار لجميع المستخدمين' : 'Send Notification to All Users'}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{isRtl ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
                <input className="w-full mt-1 border rounded px-3 py-2 text-sm" value={form.titleEn}
                  onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                <input className="w-full mt-1 border rounded px-3 py-2 text-sm" dir="rtl" value={form.titleAr}
                  onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'المحتوى (إنجليزي)' : 'Content (English)'}</label>
                <textarea className="w-full mt-1 border rounded px-3 py-2 text-sm" rows={3} value={form.contentEn}
                  onChange={e => setForm(f => ({ ...f, contentEn: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'المحتوى (عربي)' : 'Content (Arabic)'}</label>
                <textarea className="w-full mt-1 border rounded px-3 py-2 text-sm" rows={3} dir="rtl" value={form.contentAr}
                  onChange={e => setForm(f => ({ ...f, contentAr: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{isRtl ? 'النوع' : 'Type'}</label>
                <select className="w-full mt-1 border rounded px-3 py-2 text-sm" value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="info">{isRtl ? 'معلومات' : 'Info'}</option>
                  <option value="success">{isRtl ? 'نجاح' : 'Success'}</option>
                  <option value="warning">{isRtl ? 'تحذير' : 'Warning'}</option>
                  <option value="action">{isRtl ? 'إجراء مطلوب' : 'Action Required'}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'رابط الإجراء (اختياري)' : 'Action URL (optional)'}</label>
                <input className="w-full mt-1 border rounded px-3 py-2 text-sm" dir="ltr" value={form.actionUrl}
                  onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} placeholder="/courses/123" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => sendMut.mutate({ ...form, userIds: (allUsers ?? []).map((u: any) => u.id) })} disabled={!form.titleEn || !form.titleAr || sendMut.isPending}>
                {sendMut.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {isRtl ? 'إرسال' : 'Send'}
              </Button>
              <Button variant="outline" onClick={() => setShowSend(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            </div>
          </div>
        )}

        {/* Recent Notifications */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{isRtl ? 'الإشعارات الأخيرة' : 'Recent Notifications'}</h2>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : !recentNotifications?.length ? (
            <div className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد إشعارات' : 'No notifications'}</div>
          ) : (
            <div className="space-y-2">
              {recentNotifications.map((n: any) => (
                <div key={n.id} className={`bg-white border rounded-lg p-3 flex items-start gap-3 ${!n.isRead ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                  <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'warning' ? 'text-amber-500' : n.type === 'success' ? 'text-green-500' : n.type === 'action' ? 'text-red-500' : 'text-blue-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{isRtl ? n.titleAr : n.titleEn}</p>
                    {(isRtl ? n.contentAr : n.contentEn) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{isRtl ? n.contentAr : n.contentEn}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={n.isRead ? 'secondary' : 'default'} className="shrink-0 text-xs">
                    {n.isRead ? (isRtl ? 'مقروء' : 'Read') : (isRtl ? 'جديد' : 'New')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
