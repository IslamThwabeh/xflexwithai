import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Award, Gift, TrendingUp, Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LoyaltyPoints() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const { data: balanceData, isLoading: loadingBal } = trpc.points.myBalance.useQuery();
  const { data: history, isLoading: loadingHist } = trpc.points.myHistory.useQuery();
  const balance = balanceData?.balance ?? 0;

  const loading = loadingBal || loadingHist;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'earn': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'bonus': return <Gift className="w-4 h-4 text-purple-500" />;
      case 'redeem': return <Award className="w-4 h-4 text-blue-500" />;
      default: return <Award className="w-4 h-4 text-gray-400" />;
    }
  };

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

            {/* How to Earn */}
            <div className="bg-white border rounded-xl p-5 mb-6">
              <h2 className="font-semibold mb-3">{isRtl ? 'كيف تكسب النقاط؟' : 'How to Earn Points'}</h2>
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
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">★</span>
                  {isRtl ? 'مكافآت خاصة من الإدارة' : 'Special admin bonuses'}
                </div>
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
                  {isRtl ? 'لا يوجد سجل بعد' : 'No history yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((tx: any) => (
                    <div key={tx.id} className="bg-white border rounded-lg p-3 flex items-center gap-3">
                      {typeIcon(tx.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{isRtl ? tx.reasonAr : tx.reasonEn}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant={tx.amount > 0 ? 'default' : 'secondary'}
                        className={tx.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
