import { Link } from 'wouter';
import { ShoppingBag, Clock, CheckCircle, XCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

const statusIcons: Record<string, any> = {
  pending: Clock,
  awaiting_confirmation: Clock,
  paid: CheckCircle,
  completed: CheckCircle,
  cancelled: XCircle,
  refunded: XCircle,
};
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  awaiting_confirmation: 'bg-orange-100 text-orange-700',
  paid: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default function MyOrders() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery();

  const statusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'معلق' },
      awaiting_confirmation: { en: 'Awaiting Confirmation', ar: 'بانتظار التأكيد' },
      paid: { en: 'Paid', ar: 'مدفوع' },
      completed: { en: 'Completed', ar: 'مكتمل' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      refunded: { en: 'Refunded', ar: 'مسترد' },
    };
    return isRtl ? labels[status]?.ar : labels[status]?.en || status;
  };

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">{t('myOrders.title')}</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl h-24 animate-pulse border" />
            ))}
          </div>
        ) : !orders?.length ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('myOrders.noOrders')}</p>
            <Link href="/#packages">
              <Button>{t('myOrders.browsePkgs')}</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const Icon = statusIcons[order.status] || Clock;
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusColors[order.status]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">#{order.id}</span>
                          <Badge className={`text-xs ${statusColors[order.status]}`}>
                            {statusLabel(order.status)}
                          </Badge>
                          {order.isGift ? <Badge variant="outline" className="text-xs">🎁</Badge> : null}
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')} •{' '}
                          {order.paymentMethod === 'paypal' ? 'PayPal' : order.paymentMethod === 'bank_transfer' ? (isRtl ? 'حوالة بنكية' : 'Bank Transfer') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">${(order.totalAmount / 100).toFixed(2)}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-400 ${isRtl ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
