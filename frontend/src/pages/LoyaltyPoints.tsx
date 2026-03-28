import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Award, Gift, TrendingUp, Loader2, History, Copy, Check, Users, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoyaltyPoints() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [copied, setCopied] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const { data: balanceData, isLoading: loadingBal } = trpc.points.myBalance.useQuery();
  const { data: history, isLoading: loadingHist } = trpc.points.myHistory.useQuery();
  const { data: referralData } = trpc.points.myReferralCode.useQuery();
  const { data: referrals } = trpc.points.myReferrals.useQuery();
  const { data: rules } = trpc.points.rules.useQuery();
  const balance = balanceData?.balance ?? 0;

  const loading = loadingBal || loadingHist;

  const referralCode = referralData?.code ?? '';
  const referralLink = referralCode ? `${window.location.origin}/register?ref=${referralCode}` : '';
  const activeReferrals = referrals?.filter((r: any) => r.status === 'rewarded') ?? [];
  const pendingReferrals = referrals?.filter((r: any) => r.status === 'pending') ?? [];
  const totalReferralPoints = activeReferrals.reduce((sum: number, r: any) => sum + (r.referrerPoints || 0), 0);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(isRtl ? 'تم نسخ الرابط!' : 'Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const text = isRtl
      ? `انضم لأكاديمية XFlex للتداول واحصل على مكافأة ترحيبية! سجل عبر رابطي: ${referralLink}`
      : `Join XFlex Trading Academy and get a welcome bonus! Sign up with my link: ${referralLink}`;
    if (navigator.share) {
      navigator.share({ title: 'XFlex Academy', text, url: referralLink });
    } else {
      navigator.clipboard.writeText(text);
      toast.success(isRtl ? 'تم نسخ رسالة المشاركة!' : 'Share message copied!');
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'earn': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'bonus': return <Gift className="w-4 h-4 text-purple-500" />;
      case 'redeem': return <Award className="w-4 h-4 text-blue-500" />;
      default: return <Award className="w-4 h-4 text-gray-400" />;
    }
  };

  const activeRules = rules?.filter((r: any) => r.isActive) ?? [];

  const visibleHistory = showAllHistory ? history : history?.slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Award className="w-6 h-6 text-purple-500" />
          {isRtl ? 'نقاط الولاء' : 'Loyalty Points'}
        </h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl p-6 mb-6">
              <p className="text-sm opacity-80">{isRtl ? 'رصيدك الحالي' : 'Your Current Balance'}</p>
              <p className="text-4xl font-bold mt-1">{(balance ?? 0).toLocaleString()}</p>
              <p className="text-sm opacity-70 mt-1">{isRtl ? 'نقطة' : 'points'}</p>
            </div>

            {/* Referral Section */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-lg">{isRtl ? 'ادعُ أصدقاءك' : 'Invite Friends'}</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {isRtl
                  ? 'شارك رابط الإحالة الخاص بك مع أصدقائك. عندما يسجلون ويفعّلون باقتهم، تكسب أنت وصديقك نقاط مكافأة!'
                  : 'Share your referral link with friends. When they sign up and activate a package, both of you earn bonus points!'}
              </p>

              {/* Referral Code & Link */}
              {referralCode && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{isRtl ? 'كود الإحالة' : 'Your Code'}:</span>
                    <span className="font-mono font-bold text-lg tracking-wider text-amber-700">{referralCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white rounded-lg border px-3 py-2 text-xs text-gray-600 truncate font-mono">
                      {referralLink}
                    </div>
                    <Button size="sm" variant="outline" onClick={copyLink} className="gap-1 shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? (isRtl ? 'تم' : 'Done') : (isRtl ? 'نسخ' : 'Copy')}
                    </Button>
                    <Button size="sm" onClick={shareLink} className="gap-1 shrink-0 bg-amber-600 hover:bg-amber-700">
                      <Share2 className="w-3.5 h-3.5" />
                      {isRtl ? 'مشاركة' : 'Share'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Referral Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{(referrals?.length ?? 0)}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'مدعوون' : 'Invited'}</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{activeReferrals.length}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'مفعّلون' : 'Activated'}</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{totalReferralPoints}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'نقاط مكتسبة' : 'Points Earned'}</p>
                </div>
              </div>

              {/* Referral List */}
              {referrals && referrals.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {referrals.map((r: any) => (
                    <div key={r.id} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                      <span className="truncate">{r.refereeName || r.refereeEmail}</span>
                      <Badge variant={r.status === 'rewarded' ? 'default' : 'secondary'} className={`text-xs ${r.status === 'rewarded' ? 'bg-green-100 text-green-700' : ''}`}>
                        {r.status === 'rewarded'
                          ? (isRtl ? `+${r.referrerPoints} نقطة` : `+${r.referrerPoints} pts`)
                          : (isRtl ? 'بانتظار التفعيل' : 'Pending')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How to Earn — from DB rules */}
            <div className="bg-white border rounded-xl p-5 mb-6">
              <h2 className="font-semibold mb-3">{isRtl ? 'كيف تكسب النقاط؟' : 'How to Earn Points'}</h2>
              <div className="space-y-2.5">
                {activeRules.map((rule: any) => (
                  <div key={rule.id} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-center">
                      <Badge className="bg-green-100 text-green-700 font-bold">+{rule.points}</Badge>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{isRtl ? rule.nameAr : rule.nameEn}</p>
                      <p className="text-xs text-gray-500">{isRtl ? rule.descriptionAr : rule.descriptionEn}</p>
                    </div>
                  </div>
                ))}
                {activeRules.length === 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">+</span>
                      {isRtl ? 'أكمل دورة تدريبية' : 'Complete a course'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">+</span>
                      {isRtl ? 'اكتب مراجعة وتقييم' : 'Write a review & rating'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">+</span>
                      {isRtl ? 'تفاعل يومي مع المنصة' : 'Daily platform engagement'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* History */}
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <History className="w-5 h-5" />
                {isRtl ? 'سجل النقاط' : 'Points History'}
              </h2>
              {!history?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isRtl ? 'لا يوجد سجل بعد. ابدأ بتسجيل الدخول يوميًا لكسب نقاط!' : 'No history yet. Start by logging in daily to earn points!'}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {visibleHistory?.map((tx: any) => (
                      <div key={tx.id} className="bg-white border rounded-lg p-3 flex items-center gap-3">
                        {typeIcon(tx.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{isRtl ? tx.reasonAr : tx.reasonEn}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <Badge variant={tx.amount > 0 ? 'default' : 'secondary'}
                          className={tx.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {history.length > 10 && (
                    <Button variant="ghost" className="w-full mt-3 gap-1 text-sm" onClick={() => setShowAllHistory(!showAllHistory)}>
                      {showAllHistory
                        ? <><ChevronUp className="w-4 h-4" />{isRtl ? 'عرض أقل' : 'Show Less'}</>
                        : <><ChevronDown className="w-4 h-4" />{isRtl ? `عرض الكل (${history.length})` : `Show All (${history.length})`}</>}
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
