import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Plus, Minus, Loader2, Trophy, Settings2, Users, Save, ToggleLeft, ToggleRight, Gift, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'leaderboard' | 'rules' | 'referrals' | 'rewards';

export default function AdminPoints() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [showAward, setShowAward] = useState(false);
  const [awardForm, setAwardForm] = useState({ userId: 0, amount: 0, reasonEn: '', reasonAr: '' });
  const [rewardForm, setRewardForm] = useState({
    titleEn: '',
    titleAr: '',
    descriptionEn: '',
    descriptionAr: '',
    pointsCost: 100,
    stockQuantity: '',
    isActive: false,
    sortOrder: 0,
  });

  const { data: leaderboard, isLoading } = trpc.points.leaderboard.useQuery(undefined, { enabled: tab === 'leaderboard' });
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = trpc.points.adminRules.useQuery(undefined, { enabled: tab === 'rules' });
  const { data: referralStats, isLoading: refStatsLoading } = trpc.points.referralStats.useQuery(undefined, { enabled: tab === 'referrals' });
  const { data: rewardsAvailability } = trpc.points.rewardsAvailability.useQuery(undefined, { enabled: tab === 'rewards' });
  const rewardsEnabled = Boolean(rewardsAvailability?.enabled);
  const { data: rewardItems, isLoading: rewardItemsLoading, refetch: refetchRewardItems } = trpc.points.adminRewardItems.useQuery(undefined, {
    enabled: tab === 'rewards' && rewardsEnabled,
    retry: false,
  });
  const { data: rewardRedemptions, isLoading: rewardRedemptionsLoading, refetch: refetchRewardRedemptions } = trpc.points.adminRewardRedemptions.useQuery({ limit: 100 }, {
    enabled: tab === 'rewards' && rewardsEnabled,
    retry: false,
  });

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

  const createRewardMut = trpc.points.createRewardItem.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إنشاء المكافأة' : 'Reward created');
      setRewardForm({ titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '', pointsCost: 100, stockQuantity: '', isActive: false, sortOrder: 0 });
      refetchRewardItems();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRewardMut = trpc.points.updateRewardItem.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم تحديث المكافأة' : 'Reward updated'); refetchRewardItems(); },
    onError: (e) => toast.error(e.message),
  });

  const reviewRewardMut = trpc.points.reviewRewardRedemption.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم تحديث الطلب' : 'Redemption updated'); refetchRewardRedemptions(); },
    onError: (e) => toast.error(e.message),
  });

  const fulfillRewardMut = trpc.points.fulfillRewardRedemption.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم تنفيذ الطلب' : 'Redemption fulfilled'); refetchRewardRedemptions(); },
    onError: (e) => toast.error(e.message),
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'leaderboard', label: isRtl ? 'المتصدرين' : 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
    { key: 'rules', label: isRtl ? 'قواعد النقاط' : 'Points Rules', icon: <Settings2 className="w-4 h-4" /> },
    { key: 'referrals', label: isRtl ? 'الإحالات' : 'Referrals', icon: <Users className="w-4 h-4" /> },
    { key: 'rewards', label: isRtl ? 'المكافآت' : 'Rewards', icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
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
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${tab === t.key ? 'bg-white shadow-sm text-amber-700' : 'text-gray-600 hover:text-gray-900'}`}>
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
                          <Badge variant="default" className="bg-amber-100 text-amber-700">{user.pointsBalance ?? 0}</Badge>
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

        {/* Rewards Tab */}
        {tab === 'rewards' && (
          <RewardsTab
            enabled={rewardsEnabled}
            items={rewardItems}
            redemptions={rewardRedemptions}
            itemsLoading={rewardItemsLoading}
            redemptionsLoading={rewardRedemptionsLoading}
            form={rewardForm}
            setForm={setRewardForm}
            isRtl={isRtl}
            creating={createRewardMut.isPending}
            updating={updateRewardMut.isPending || reviewRewardMut.isPending || fulfillRewardMut.isPending}
            onCreate={() => createRewardMut.mutate({
              titleEn: rewardForm.titleEn,
              titleAr: rewardForm.titleAr,
              descriptionEn: rewardForm.descriptionEn || null,
              descriptionAr: rewardForm.descriptionAr || null,
              pointsCost: rewardForm.pointsCost,
              stockQuantity: rewardForm.stockQuantity === '' ? null : Number(rewardForm.stockQuantity),
              isActive: rewardForm.isActive,
              sortOrder: rewardForm.sortOrder,
            })}
            onToggle={(item) => updateRewardMut.mutate({ id: item.id, isActive: !item.isActive })}
            onApprove={(id) => reviewRewardMut.mutate({ id, decision: 'approved' })}
            onReject={(id) => {
              const note = prompt(isRtl ? 'سبب الرفض أو ملاحظة اختيارية:' : 'Optional rejection note:');
              reviewRewardMut.mutate({ id, decision: 'rejected', adminNote: note || null });
            }}
            onFulfill={(id) => {
              const note = prompt(isRtl ? 'ملاحظة التنفيذ اختيارية:' : 'Optional fulfillment note:');
              fulfillRewardMut.mutate({ id, adminNote: note || null });
            }}
          />
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
                    <Badge className="bg-amber-100 text-amber-700 text-sm">+{rule.points}</Badge>
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
    { label: isRtl ? 'إجمالي الإحالات' : 'Total Referrals', value: stats.total ?? 0, color: 'bg-emerald-100 text-emerald-700' },
    { label: isRtl ? 'إحالات مفعّلة' : 'Activated', value: stats.activated ?? 0, color: 'bg-green-100 text-green-700' },
    { label: isRtl ? 'نقاط ممنوحة' : 'Points Awarded', value: stats.totalPointsAwarded ?? 0, color: 'bg-amber-100 text-amber-700' },
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

function RewardsTab({
  enabled,
  items,
  redemptions,
  itemsLoading,
  redemptionsLoading,
  form,
  setForm,
  isRtl,
  creating,
  updating,
  onCreate,
  onToggle,
  onApprove,
  onReject,
  onFulfill,
}: {
  enabled: boolean;
  items: any[] | undefined;
  redemptions: any[] | undefined;
  itemsLoading: boolean;
  redemptionsLoading: boolean;
  form: {
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    descriptionAr: string;
    pointsCost: number;
    stockQuantity: string;
    isActive: boolean;
    sortOrder: number;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    descriptionAr: string;
    pointsCost: number;
    stockQuantity: string;
    isActive: boolean;
    sortOrder: number;
  }>>;
  isRtl: boolean;
  creating: boolean;
  updating: boolean;
  onCreate: () => void;
  onToggle: (item: any) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onFulfill: (id: number) => void;
}) {
  if (!enabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Gift className="h-5 w-5" />
          {isRtl ? 'مكافآت الولاء غير مفعّلة' : 'Loyalty rewards are disabled'}
        </div>
        <p>
          {isRtl
            ? 'كتالوج المكافآت وطلبات الاستبدال خلف مفتاح loyalty_rewards_enabled المعطل افتراضياً. لا يظهر للطلاب ولا يقبل طلبات حتى يتم تفعيله بموافقة منفصلة.'
            : 'The reward catalog and redemption workflow are behind the disabled loyalty_rewards_enabled flag. Students cannot see or redeem rewards until it is enabled with separate approval.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4 text-amber-600" />
          {isRtl ? 'إضافة مكافأة' : 'Add reward'}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <RewardInput label={isRtl ? 'العنوان الإنجليزي' : 'English title'} value={form.titleEn} onChange={(value) => setForm((current) => ({ ...current, titleEn: value }))} />
          <RewardInput label={isRtl ? 'العنوان العربي' : 'Arabic title'} value={form.titleAr} onChange={(value) => setForm((current) => ({ ...current, titleAr: value }))} dir="rtl" />
          <RewardInput label={isRtl ? 'الوصف الإنجليزي' : 'English description'} value={form.descriptionEn} onChange={(value) => setForm((current) => ({ ...current, descriptionEn: value }))} />
          <RewardInput label={isRtl ? 'الوصف العربي' : 'Arabic description'} value={form.descriptionAr} onChange={(value) => setForm((current) => ({ ...current, descriptionAr: value }))} dir="rtl" />
          <RewardInput label={isRtl ? 'تكلفة النقاط' : 'Points cost'} type="number" value={String(form.pointsCost || '')} onChange={(value) => setForm((current) => ({ ...current, pointsCost: Number(value) || 0 }))} />
          <RewardInput label={isRtl ? 'المخزون، اتركه فارغاً لغير محدود' : 'Stock, blank for unlimited'} type="number" value={form.stockQuantity} onChange={(value) => setForm((current) => ({ ...current, stockQuantity: value }))} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            {isRtl ? 'نشطة للطلاب' : 'Active for students'}
          </label>
          <Button onClick={onCreate} disabled={creating || !form.titleEn.trim() || !form.titleAr.trim() || form.pointsCost < 1}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRtl ? 'حفظ المكافأة' : 'Save reward'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Gift className="h-5 w-5 text-amber-500" />
            {isRtl ? 'كتالوج المكافآت' : 'Reward catalog'}
          </h3>
          {itemsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !items?.length ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد مكافآت بعد' : 'No rewards yet'}</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{isRtl ? item.titleAr : item.titleEn}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{isRtl ? item.descriptionAr : item.descriptionEn}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">{item.pointsCost} pts</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{isRtl ? 'المخزون' : 'Stock'}: {item.stockQuantity ?? (isRtl ? 'غير محدود' : 'Unlimited')}</span>
                    <Button size="sm" variant="outline" disabled={updating} onClick={() => onToggle(item)}>
                      {item.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                      {item.isActive ? (isRtl ? 'نشطة' : 'Active') : (isRtl ? 'غير نشطة' : 'Inactive')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            {isRtl ? 'طلبات الاستبدال' : 'Redemption requests'}
          </h3>
          {redemptionsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !redemptions?.length ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد طلبات بعد' : 'No redemption requests yet'}</div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((request) => (
                <div key={request.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{isRtl ? request.titleAr : request.titleEn}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{request.studentEmail}</p>
                    </div>
                    <Badge className={rewardStatusClass(request.status)}>{rewardStatusLabel(request.status, isRtl)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {request.status === 'pending' && (
                      <>
                        <Button size="sm" disabled={updating} onClick={() => onApprove(request.id)}>
                          <CheckCircle2 className="h-4 w-4" /> {isRtl ? 'اعتماد' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="outline" disabled={updating} onClick={() => onReject(request.id)}>
                          <XCircle className="h-4 w-4" /> {isRtl ? 'رفض واسترجاع' : 'Reject & refund'}
                        </Button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <Button size="sm" disabled={updating} onClick={() => onFulfill(request.id)}>
                        <PackageCheck className="h-4 w-4" /> {isRtl ? 'تم التنفيذ' : 'Mark fulfilled'}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">{request.pointsCost} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RewardInput({ label, value, onChange, type = 'text', dir }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border px-3 py-2 text-sm"
      />
    </label>
  );
}

function rewardStatusLabel(status: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ['Pending', 'بانتظار المراجعة'],
    approved: ['Approved', 'معتمد'],
    rejected: ['Rejected/refunded', 'مرفوض/مسترجع'],
    fulfilled: ['Fulfilled', 'منفذ'],
  };
  return labels[status]?.[isRtl ? 1 : 0] ?? status;
}

function rewardStatusClass(status: string) {
  if (status === 'approved') return 'bg-blue-100 text-blue-700';
  if (status === 'fulfilled') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}
