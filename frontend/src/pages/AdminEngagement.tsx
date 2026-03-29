import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Loader2, Activity, TrendingUp, Users, Eye, BookOpen, MousePointerClick } from 'lucide-react';

export default function AdminEngagement() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const { data: summary7, isLoading: l7 } = trpc.engagement.summary.useQuery({ days: 7 });
  const { data: summary30, isLoading: l30 } = trpc.engagement.summary.useQuery({ days: 30 });

  const loading = l7 || l30;

  const eventTypeIcon = (type: string) => {
    if (type.includes('view')) return <Eye className="w-4 h-4" />;
    if (type.includes('course') || type.includes('lesson')) return <BookOpen className="w-4 h-4" />;
    if (type.includes('click') || type.includes('search')) return <MousePointerClick className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-500" />
          {isRtl ? 'لوحة تتبع التفاعل' : 'Engagement Dashboard'}
        </h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={<Activity className="w-5 h-5 text-emerald-500" />}
                label={isRtl ? 'الأحداث (7 أيام)' : 'Events (7 days)'}
                value={summary7?.totalEvents ?? 0}
              />
              <SummaryCard
                icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                label={isRtl ? 'الأحداث (30 يوم)' : 'Events (30 days)'}
                value={summary30?.totalEvents ?? 0}
              />
              <SummaryCard
                icon={<Users className="w-5 h-5 text-amber-500" />}
                label={isRtl ? 'أنواع (7 أيام)' : 'Types (7 days)'}
                value={summary7?.byType?.length ?? 0}
              />
              <SummaryCard
                icon={<Users className="w-5 h-5 text-amber-500" />}
                label={isRtl ? 'أنواع (30 يوم)' : 'Types (30 days)'}
                value={summary30?.byType?.length ?? 0}
              />
            </div>

            {/* By Type Breakdown - 7 days */}
            <div className="grid gap-6 md:grid-cols-2">
              <BreakdownPanel
                title={isRtl ? 'التفاعل خلال 7 أيام' : '7-Day Engagement Breakdown'}
                data={summary7?.byType || []}
                isRtl={isRtl}
                eventTypeIcon={eventTypeIcon}
              />
              <BreakdownPanel
                title={isRtl ? 'التفاعل خلال 30 يوم' : '30-Day Engagement Breakdown'}
                data={summary30?.byType || []}
                isRtl={isRtl}
                eventTypeIcon={eventTypeIcon}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({ title, data, isRtl, eventTypeIcon }: { title: string; data: any[]; isRtl: boolean; eventTypeIcon: (t: string) => React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {!data.length ? (
        <p className="text-sm text-muted-foreground">{isRtl ? 'لا توجد بيانات' : 'No data'}</p>
      ) : (
        <div className="space-y-2">
          {data.map((item: any) => (
            <div key={item.eventType} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {eventTypeIcon(item.eventType)}
                <span className="truncate">{item.eventType}</span>
              </div>
              <span className="font-medium tabular-nums shrink-0">{Number(item.count).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
