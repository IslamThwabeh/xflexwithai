import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Bell, Check, CheckCheck, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import ClientLayout from '@/components/ClientLayout';

export default function NotificationCenter() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [, navigate] = useLocation();

  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery();
  const unreadCount = unreadData?.count ?? 0;

  const markReadMut = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllMut = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

  const typeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'action': return 'text-red-500';
      default: return 'text-emerald-500';
    }
  };

  return (
    <ClientLayout>
    <div className="min-h-screen bg-[var(--color-xf-cream)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-nowrap">
            <Bell className="w-6 h-6 text-emerald-500 shrink-0" />
            <span>{isRtl ? 'الإشعارات' : 'Notifications'}</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 shrink-0 leading-none">{unreadCount}</span>
            )}
          </h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}>
              <CheckCheck className="w-4 h-4 me-1" />
              {isRtl ? 'قراءة الكل' : 'Mark All Read'}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !notifications?.length ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground">{isRtl ? 'لا توجد إشعارات' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div key={n.id}
                className={`bg-white border rounded-lg p-4 transition-colors cursor-pointer hover:bg-gray-50 ${!n.isRead ? 'border-emerald-200 bg-emerald-50/40' : ''}`}
                onClick={() => {
                  if (!n.isRead) markReadMut.mutate({ notificationId: n.id });
                  if (n.actionUrl) navigate(n.actionUrl);
                }}>
                <div className="flex items-start gap-3">
                  <Bell className={`w-4 h-4 mt-1 shrink-0 ${typeColor(n.type)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {isRtl ? n.titleAr : n.titleEn}
                      </p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                    </div>
                    {(isRtl ? n.contentAr : n.contentEn) && (
                      <p className="text-xs text-muted-foreground mt-1">{isRtl ? n.contentAr : n.contentEn}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                      {n.actionUrl && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2"
                      onClick={(e) => { e.stopPropagation(); markReadMut.mutate({ notificationId: n.id }); }}>
                      <Check className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </ClientLayout>
  );
}
