import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Plus, Minus, Loader2, Trophy, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminPoints() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [showAward, setShowAward] = useState(false);
  const [awardForm, setAwardForm] = useState({ userId: 0, amount: 0, reasonEn: '', reasonAr: '' });
  const [userSearch, setUserSearch] = useState('');

  const { data: leaderboard, isLoading } = trpc.points.leaderboard.useQuery();

  const awardMut = trpc.points.award.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم منح النقاط' : 'Points awarded'); setShowAward(false); },
    onError: (e) => toast.error(e.message),
  });

  const deductMut = trpc.points.deduct.useMutation({
    onSuccess: () => toast.success(isRtl ? 'تم خصم النقاط' : 'Points deducted'),
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-500" />
            {isRtl ? 'نظام نقاط الولاء' : 'Loyalty Points System'}
          </h1>
          <Button onClick={() => setShowAward(!showAward)}>
            <Plus className="w-4 h-4 me-2" />
            {isRtl ? 'منح نقاط' : 'Award Points'}
          </Button>
        </div>

        {/* Award Form */}
        {showAward && (
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

        {/* Leaderboard */}
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
      </div>
    </DashboardLayout>
  );
}
