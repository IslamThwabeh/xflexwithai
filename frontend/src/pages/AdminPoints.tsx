import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Plus, Minus, Loader2, Trophy, Settings2, Users, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'leaderboard' | 'rules' | 'referrals';

export default function AdminPoints() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [showAward, setShowAward] = useState(false);
  const [awardForm, setAwardForm] = useState({ userId: 0, amount: 0, reasonEn: '', reasonAr: '' });

  const { data: leaderboard, isLoading } = trpc.points.leaderboard.useQuery(undefined, { enabled: tab === 'leaderboard' });
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = trpc.points.adminRules.useQuery(undefined, { enabled: tab === 'rules' });
  const { data: referralStats, isLoading: refStatsLoading } = trpc.points.referralStats.useQuery(undefined, { enabled: tab === 'referrals' });

  const awardMut = trpc.points.award.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم منح النقاط' : 'Points awarded'); setShowAward(false); },
    onError: (e) => toast.error(e.message),
  });

  const deductMut = trpc.points.deduct.useMutation({
    onSuccess: () => toast.success(isRtl ? 'تم خصم النقاط' : 'Points deducted'),
    onError: (e) => toast.error(e.message),
  });

  const updateRuleMut = trpc.points.updateRule.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم تحديث القاعدة' : 'Rule updated'); refetchRules(); },
    onError: (e) => toast.error(e.message),
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'leaderboard', label: isRtl ? 'المتصدرين' : 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
    { key: 'rules', label: isRtl ? 'قواعد النقاط' : 'Points Rules', icon: <Settings2 className="w-4 h-4" /> },
    { key: 'referrals', label: isRtl ? 'الإحالات' : 'Referrals', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-500" />
            {isRtl ? 'نظام نقاط الولاء' : 'Loyalty Points System'}
          </h1>
          {tab === 'leaderboard' && (
            <Button onClick={() => setShowAward(!showAward)}>
              <Plus className="w-4 h-4 me-2" />
              {isRtl ? 'منح نقاط' : 'Award Points'}
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${tab === t.key ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:text-gray-900'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Award Form */}
        {showAward && tab === 'leaderboard' && (
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold">{isRtl ? 'منح نقاط لمستخدم' : 'Award Points to User'}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{isRtl ? 'معرّف المستخدم' : 'User ID'}</label>
                <input type="number" className="w-full mt-1 border rounded px-3 py-2 text-sm" value={awardForm.userId || ''}
                  onChange={e => setAwardForm(f => ({ ...f, userId: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'عدد النقاط' : 'Points Amount'}</label>
                <input type="number" className="w-full mt-1 border rounded px-3 py-2 text-sm" value={awardForm.amount || ''}
                  onChange={e => setAwardForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'السبب (إنجليزي)' : 'Reason (English)'}</label>
                <input className="w-full mt-1 border rounded px-3 py-2 text-sm" value={awardForm.reasonEn}
                  onChange={e => setAwardForm(f => ({ ...f, reasonEn: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'السبب (عربي)' : 'Reason (Arabic)'}</label>
                <input className="w-full mt-1 border rounded px-3 py-2 text-sm" dir="rtl" value={awardForm.reasonAr}
                  onChange={e => setAwardForm(f => ({ ...f, reasonAr: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => awardMut.mutate(awardForm)} disabled={!awardForm.userId || !awardForm.amount || awardMut.isPending}>
                {awardMut.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {isRtl ? 'منح' : 'Award'}
              </Button>
              <Button variant="outline" onClick={() => setShowAward(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {tab === 'leaderboard' && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              {isRtl ? 'لوحة المتصدرين' : 'Points Leaderboard'}
            </h2>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !leaderboard?.length ? (
              <div className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد بيانات' : 'No data yet'}</div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-start p-3">#</th>
                      <th className="text-start p-3">{isRtl ? 'المستخدم' : 'User'}</th>
                      <th className="text-start p-3">{isRtl ? 'البريد' : 'Email'}</th>
                      <th className="text-center p-3">{isRtl ? 'النقاط' : 'Points'}</th>
                      <th className="text-center p-3">{isRtl ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((user: any, i: number) => (
                      <tr key={user.id} className="border-t hover:bg-gray-50/50">
                        <td className="p-3">
                          {i < 3 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-700'}`}>
                              {i + 1}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{i + 1}</span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{user.name || '-'}</td>
                        <td className="p-3 text-muted-foreground">{user.email}</td>
                        <td className="p-3 text-center">
                          <Badge variant="default" className="bg-purple-100 text-purple-700">{user.pointsBalance ?? 0}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="ghost" className="text-red-500 h-7 px-2"
                            onClick={() => {
                              const amt = prompt(isRtl ? 'عدد النقاط للخصم:' : 'Points to deduct:');
                              if (amt && parseInt(amt) > 0) {
                                deductMut.mutate({ userId: user.id, amount: parseInt(amt), reasonEn: 'Admin deduction', reasonAr: 'خصم إداري' });
                              }
                            }}>
                            <Minus className="w-3 h-3 me-1" /> {isRtl ? 'خصم' : 'Deduct'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rules Tab */}
        {tab === 'rules' && (
          <RulesTab rules={rules} isLoading={rulesLoading} isRtl={isRtl} onUpdate={(id, data) => updateRuleMut.mutate({ id, ...data })} updating={updateRuleMut.isPending} />
        )}

        {/* Referrals Tab */}
        {tab === 'referrals' && (
          <ReferralsTab stats={referralStats} isLoading={refStatsLoading} isRtl={isRtl} />
        )}
      </div>
    </DashboardLayout>
  );
}

function RulesTab({ rules, isLoading, isRtl, onUpdate, updating }: {
  rules: any[] | undefined; isLoading: boolean; isRtl: boolean;
  onUpdate: (id: number, data: { points?: number; isActive?: boolean; maxPerDay?: number | null }) => void;
  updating: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState(0);
  const [editMaxPerDay, setEditMaxPerDay] = useState<string>('');

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!rules?.length) return <div className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد قواعد' : 'No rules configured'}</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{isRtl ? 'تحكم في عدد النقاط الممنوحة لكل نشاط' : 'Control how many points are awarded for each activity'}</p>
      <div className="grid gap-3">
        {rules.map((rule: any) => {
          const isEditing = editingId === rule.id;
          return (
            <div key={rule.id} className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{isRtl ? rule.nameAr : rule.nameEn}</span>
                  <Badge variant="outline" className="text-xs font-mono">{rule.ruleKey}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{isRtl ? rule.descriptionAr : rule.descriptionEn}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isEditing ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{isRtl ? 'النقاط' : 'Points'}</label>
                      <input type="number" min={0} className="w-20 border rounded px-2 py-1 text-sm text-center"
                        value={editPoints} onChange={e => setEditPoints(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{isRtl ? 'حد يومي' : 'Daily Cap'}</label>
                      <input type="number" min={0} className="w-20 border rounded px-2 py-1 text-sm text-center"
                        placeholder="∞" value={editMaxPerDay} onChange={e => setEditMaxPerDay(e.target.value)} />
                    </div>
                    <Button size="sm" disabled={updating} onClick={() => {
                      onUpdate(rule.id, { points: editPoints, maxPerDay: editMaxPerDay ? parseInt(editMaxPerDay) : null });
                      setEditingId(null);
                    }}>
                      <Save className="w-3 h-3 me-1" /> {isRtl ? 'حفظ' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge className="bg-purple-100 text-purple-700 text-sm">+{rule.points}</Badge>
                    {rule.maxPerDay && (
                      <span className="text-xs text-muted-foreground">{isRtl ? `حد: ${rule.maxPerDay}/يوم` : `Cap: ${rule.maxPerDay}/day`}</span>
                    )}
                    <button onClick={() => onUpdate(rule.id, { isActive: !rule.isActive })}
                      className={`transition-colors ${rule.isActive ? 'text-green-500' : 'text-gray-400'}`}>
                      {rule.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingId(rule.id); setEditPoints(rule.points); setEditMaxPerDay(rule.maxPerDay?.toString() || '');
                    }}>
                      {isRtl ? 'تعديل' : 'Edit'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferralsTab({ stats, isLoading, isRtl }: { stats: any; isLoading: boolean; isRtl: boolean }) {
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!stats) return <div className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد بيانات' : 'No data'}</div>;

  const statCards = [
    { label: isRtl ? 'إجمالي الإحالات' : 'Total Referrals', value: stats.total ?? 0, color: 'bg-blue-100 text-blue-700' },
    { label: isRtl ? 'إحالات مفعّلة' : 'Activated', value: stats.activated ?? 0, color: 'bg-green-100 text-green-700' },
    { label: isRtl ? 'نقاط ممنوحة' : 'Points Awarded', value: stats.totalPointsAwarded ?? 0, color: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border rounded-xl p-5 text-center">
            <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
            <Badge className={`text-lg px-3 py-1 ${s.color}`}>{s.value}</Badge>
          </div>
        ))}
      </div>

      {/* Top Referrers */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          {isRtl ? 'أفضل المُحيلين' : 'Top Referrers'}
        </h3>
        {!stats.topReferrers?.length ? (
          <div className="text-center py-6 text-muted-foreground">{isRtl ? 'لا يوجد مُحيلين بعد' : 'No referrers yet'}</div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-start p-3">#</th>
                  <th className="text-start p-3">{isRtl ? 'المستخدم' : 'User'}</th>
                  <th className="text-center p-3">{isRtl ? 'عدد الإحالات' : 'Referrals'}</th>
                </tr>
              </thead>
              <tbody>
                {stats.topReferrers.map((r: any, i: number) => (
                  <tr key={r.referrerId} className="border-t hover:bg-gray-50/50">
                    <td className="p-3">
                      {i < 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-700'}`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{i + 1}</span>
                      )}
                    </td>
                    <td className="p-3 font-medium">{r.name || r.email || `#${r.referrerId}`}</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-amber-100 text-amber-700">{r.count}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
