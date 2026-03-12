import { Link, useParams } from 'wouter';
import { ArrowLeft, ShoppingBag, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';
import { useState } from 'react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  awaiting_confirmation: 'bg-orange-100 text-orange-700',
  paid: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default function OrderDetail() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const utils = trpc.useUtils();
  const { data: order, isLoading } = trpc.orders.byId.useQuery({ id: orderId });
  const uploadMutation = trpc.orders.uploadProof.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم رفع الإيصال بنجاح' : 'Proof uploaded successfully');
      utils.orders.byId.invalidate({ id: orderId });
    },
    onError: (e) => toast.error(e.message),
  });
  const [proofUrl, setProofUrl] = useState('');
  const [reference, setReference] = useState('');

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

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </ClientLayout>
    );
  }

  if (!order) {
    return (
      <ClientLayout>
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{t('myOrders.notFound')}</p>
          <Link href="/orders"><Button variant="outline">{t('myOrders.backToOrders')}</Button></Link>
        </div>
      </ClientLayout>
    );
  }

  const handleUploadProof = () => {
    if (!proofUrl.trim()) return;
    uploadMutation.mutate({
      orderId: order.id,
      paymentProofUrl: proofUrl.trim(),
      paymentReference: reference.trim() || undefined,
    });
  };

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="mb-6 text-gray-500">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
            {t('myOrders.backToOrders')}
          </Button>
        </Link>

        <div className="bg-white border rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{isRtl ? 'طلب' : 'Order'} #{order.id}</h1>
            <Badge className={`text-sm px-3 py-1 ${statusColors[order.status]}`}>
              {statusLabel(order.status)}
            </Badge>
          </div>

          {/* Order details */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <span className="text-gray-500">{isRtl ? 'التاريخ' : 'Date'}:</span>{' '}
              {new Date(order.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
            </div>
            <div>
              <span className="text-gray-500">{isRtl ? 'طريقة الدفع' : 'Payment Method'}:</span>{' '}
              {order.paymentMethod === 'paypal' ? 'PayPal' : order.paymentMethod === 'bank_transfer' ? (isRtl ? 'حوالة بنكية' : 'Bank Transfer') : '—'}
            </div>
            {order.paymentReference && (
              <div>
                <span className="text-gray-500">{isRtl ? 'مرجع الدفع' : 'Ref'}:</span> {order.paymentReference}
              </div>
            )}
            {order.isGift ? (
              <div>
                <span className="text-gray-500">🎁 {isRtl ? 'هدية إلى' : 'Gift to'}:</span> {order.giftEmail}
              </div>
            ) : null}
          </div>

          {/* Price breakdown */}
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{isRtl ? 'المبلغ الفرعي' : 'Subtotal'}</span>
              <span>${(order.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">VAT ({order.vatRate}%)</span>
              <span>${(order.vatAmount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
              <span>${(order.totalAmount / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Upload proof for bank transfer orders */}
        {order.paymentMethod === 'bank_transfer' && order.status === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              {isRtl ? 'رفع إيصال الدفع' : 'Upload Payment Proof'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {isRtl ? 'يرجى رفع صورة إيصال التحويل البنكي لتأكيد طلبك' : 'Please upload a screenshot/image of your bank transfer receipt to confirm your order.'}
            </p>
            <div className="space-y-3">
              <div>
                <Label>{isRtl ? 'رابط صورة الإيصال' : 'Receipt Image URL'}</Label>
                <Input
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{isRtl ? 'رقم المرجع (اختياري)' : 'Reference Number (optional)'}</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={isRtl ? 'رقم العملية' : 'Transaction #'}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleUploadProof} disabled={!proofUrl.trim() || uploadMutation.isPending}>
                {uploadMutation.isPending ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'رفع الإيصال' : 'Submit Proof')}
              </Button>
            </div>
          </div>
        )}

        {order.status === 'awaiting_confirmation' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
            <Clock className="w-10 h-10 text-orange-500 mx-auto mb-2" />
            <p className="font-medium">{isRtl ? 'تم إرسال إيصال الدفع' : 'Payment proof submitted'}</p>
            <p className="text-sm text-gray-600">{isRtl ? 'سيتم مراجعة طلبك وتأكيده قريباً' : 'Your order is being reviewed and will be confirmed shortly.'}</p>
          </div>
        )}

        {order.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-medium">{isRtl ? 'تم تأكيد الطلب!' : 'Order Confirmed!'}</p>
            <p className="text-sm text-gray-600 mb-4">{isRtl ? 'يمكنك الآن الوصول إلى محتوى الباقة' : 'You can now access your package content.'}</p>
            <Link href="/dashboard">
              <Button>{isRtl ? 'إلى لوحة التحكم' : 'Go to Dashboard'}</Button>
            </Link>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
