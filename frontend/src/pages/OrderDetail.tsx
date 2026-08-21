import { Link, useParams } from 'wouter';
import { ArrowLeft, ShoppingBag, Upload, CheckCircle, Clock, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { formatPaymentMethodLabel } from '@/lib/paymentMethodLabel';
import { apiFetch } from '@/lib/apiBase';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  awaiting_confirmation: 'bg-orange-100 text-orange-700',
  paid: 'bg-emerald-100 text-emerald-700',
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
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState('');
  const [proofUploadError, setProofUploadError] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const uploadTelemetry = trpc.engagement.track.useMutation();

  useEffect(() => {
    if (!proofFile || proofFile.type === 'application/pdf') {
      setProofPreviewUrl('');
      return;
    }
    const previewUrl = URL.createObjectURL(proofFile);
    setProofPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [proofFile]);

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
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
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

  const getPaymentProofError = (code?: string) => {
    const messages: Record<string, { en: string; ar: string }> = {
      file_too_large: {
        en: 'The receipt must be 10 MB or smaller.',
        ar: 'يجب ألا يتجاوز حجم الإيصال 10 ميجابايت.',
      },
      unsupported_file_type: {
        en: 'Use a JPEG, PNG, WebP, HEIC, or PDF receipt.',
        ar: 'استخدم إيصالاً بصيغة JPEG أو PNG أو WebP أو HEIC أو PDF.',
      },
      invalid_order_status: {
        en: 'This order no longer accepts payment-proof uploads.',
        ar: 'هذا الطلب لم يعد يقبل رفع إثبات الدفع.',
      },
      storage_failed: {
        en: 'Storage was temporarily unavailable. Please retry the same file.',
        ar: 'تعذر الوصول إلى التخزين مؤقتاً. يرجى إعادة محاولة رفع الملف نفسه.',
      },
      order_update_failed: {
        en: 'The receipt was not linked to the order. Please retry.',
        ar: 'لم يتم ربط الإيصال بالطلب. يرجى المحاولة مرة أخرى.',
      },
      unauthorized: {
        en: 'Your session expired. Please sign in and retry.',
        ar: 'انتهت جلستك. يرجى تسجيل الدخول والمحاولة مرة أخرى.',
      },
    };
    const selected = code ? messages[code] : undefined;
    return selected
      ? (isRtl ? selected.ar : selected.en)
      : (isRtl ? 'تعذر رفع إثبات الدفع. يرجى المحاولة مرة أخرى.' : 'Payment-proof upload failed. Please retry.');
  };

  const clearProofFile = () => {
    setProofFile(null);
    setProofUploadError('');
    if (proofInputRef.current) proofInputRef.current.value = '';
  };

  const recordClientUploadFailure = (input: {
    errorCode: string;
    fileSize?: number;
    contentType?: string;
    stage: 'client_validation' | 'request';
  }) => {
    void uploadTelemetry.mutateAsync({
      eventType: 'payment_proof_upload_failed',
      entityType: 'order',
      entityId: orderId,
      metadata: JSON.stringify({
        ...input,
        outcome: 'failed',
        reportedBy: 'client',
      }),
    }).catch(() => undefined);
  };

  const handleProofFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setProofUploadError('');
    if (!selected) {
      setProofFile(null);
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      const message = getPaymentProofError('file_too_large');
      setProofUploadError(message);
      setProofFile(null);
      event.target.value = '';
      recordClientUploadFailure({
        errorCode: 'file_too_large',
        fileSize: selected.size,
        contentType: selected.type || 'unknown',
        stage: 'client_validation',
      });
      return;
    }
    setProofFile(selected);
  };

  const handleUploadProof = async () => {
    if (!proofFile || isUploadingProof) return;
    setIsUploadingProof(true);
    setProofUploadError('');

    try {
      const params = new URLSearchParams({ orderId: String(order.id) });
      if (reference.trim()) params.set('reference', reference.trim());
      const response = await apiFetch(`/api/uploads/payment-proof?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': proofFile.type || 'application/octet-stream',
        },
        body: proofFile,
      });
      const payload = await response.json().catch(() => ({})) as {
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        throw Object.assign(new Error(payload.message || 'Payment-proof upload failed'), {
          code: payload.code,
        });
      }

      toast.success(isRtl ? 'تم رفع الإيصال وإرساله للمراجعة' : 'Receipt uploaded and submitted for review');
      clearProofFile();
      setReference('');
      await utils.orders.byId.invalidate({ id: orderId });
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
      const message = getPaymentProofError(code);
      setProofUploadError(message);
      toast.error(message);
      recordClientUploadFailure({
        errorCode: code || 'request_failed',
        fileSize: proofFile.size,
        contentType: proofFile.type || 'unknown',
        stage: 'request',
      });
    } finally {
      setIsUploadingProof(false);
    }
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
              {formatPaymentMethodLabel(order.paymentMethod, language)}
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
              <span>{formatAdminCurrencyFromIls(order.displaySubtotalIls, language)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">VAT ({order.vatRate}%)</span>
              <span>{formatAdminCurrencyFromIls(order.displayVatIls, language)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
              <span>{formatAdminCurrencyFromIls(order.displayTotalIls, language)}</span>
            </div>
          </div>
        </div>

        {/* Upload proof for bank transfer orders */}
        {order.paymentMethod === 'bank_transfer' && ['pending', 'awaiting_confirmation'].includes(order.status) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              {order.status === 'awaiting_confirmation'
                ? (isRtl ? 'استبدال إيصال الدفع' : 'Replace Payment Proof')
                : (isRtl ? 'رفع إيصال الدفع' : 'Upload Payment Proof')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {order.status === 'awaiting_confirmation'
                ? (isRtl ? 'يمكنك استبدال الإيصال الحالي إذا رفعت ملفاً غير صحيح.' : 'You can replace the current receipt if you uploaded the wrong file.')
                : (isRtl ? 'يرجى رفع صورة إيصال التحويل البنكي لتأكيد طلبك' : 'Please upload a screenshot/image of your bank transfer receipt to confirm your order.')}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="payment-proof-file">
                  {isRtl ? 'صورة أو ملف إيصال التحويل البنكي' : 'Bank Transfer Receipt'}
                </Label>
                <input
                  ref={proofInputRef}
                  id="payment-proof-file"
                  data-testid="payment-proof-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  onChange={handleProofFileChange}
                  disabled={isUploadingProof}
                  className="block w-full rounded-lg border border-gray-300 bg-white text-sm file:me-3 file:border-0 file:bg-emerald-100 file:px-4 file:py-3 file:font-medium file:text-emerald-800 hover:file:bg-emerald-200 disabled:opacity-60"
                />
                <p className="text-xs text-gray-500">
                  {isRtl
                    ? 'JPEG أو PNG أو WebP أو HEIC أو PDF — حتى 10 ميجابايت.'
                    : 'JPEG, PNG, WebP, HEIC, or PDF — up to 10 MB.'}
                </p>
                {proofFile && (
                  <div className="rounded-xl border border-emerald-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{proofFile.name}</p>
                        <p className="text-xs text-gray-500">{(proofFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearProofFile}
                        disabled={isUploadingProof}
                        aria-label={isRtl ? 'إزالة الملف' : 'Remove file'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {proofPreviewUrl ? (
                      <img
                        src={proofPreviewUrl}
                        alt={isRtl ? 'معاينة إيصال الدفع' : 'Payment receipt preview'}
                        className="mt-3 max-h-64 w-full rounded-lg bg-gray-50 object-contain"
                      />
                    ) : proofFile.type === 'application/pdf' ? (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                        <FileText className="h-5 w-5" />
                        PDF
                      </div>
                    ) : null}
                  </div>
                )}
                {proofUploadError && (
                  <p className="text-sm text-red-600" role="alert">{proofUploadError}</p>
                )}
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
              <Button
                data-testid="payment-proof-submit"
                onClick={handleUploadProof}
                disabled={!proofFile || isUploadingProof}
              >
                {isUploadingProof ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {isRtl ? 'جاري الرفع والإرسال...' : 'Uploading and submitting...'}
                  </>
                ) : (
                  isRtl ? 'رفع الإيصال وإرساله للمراجعة' : 'Upload and submit proof'
                )}
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
            {(order as any).activationKeys?.length ? (
              <>
                <p className="font-medium">{isRtl ? 'تم تأكيد الدفع ومفتاحك جاهز' : 'Payment confirmed and your key is ready'}</p>
                <p className="text-sm text-gray-600 mb-4">
                  {isRtl ? 'المفتاح مربوط ببريدك. أدخله مرة واحدة فقط لبدء الباقة.' : 'The key is bound to your email. Enter it once to start the package.'}
                </p>
                <div className="space-y-2 mb-4">
                  {(order as any).activationKeys.map((key: any) => (
                    <div key={key.id} className="rounded-lg border border-emerald-200 bg-white p-3" dir="ltr">
                      <code className="font-mono font-bold tracking-wider break-all">{key.keyCode}</code>
                      {key.activatedAt && (
                        <p className="mt-1 text-xs text-emerald-700">{isRtl ? 'تم التفعيل' : 'Activated'}</p>
                      )}
                    </div>
                  ))}
                </div>
                {(order as any).activationKeys.some((key: any) => !key.activatedAt) ? (
                  <Link href="/activate-key">
                    <Button>{isRtl ? 'تفعيل المفتاح' : 'Activate Key'}</Button>
                  </Link>
                ) : (
                  <Link href="/courses">
                    <Button>{isRtl ? 'إلى الكورسات' : 'Go to Courses'}</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">{isRtl ? 'تم تأكيد الطلب!' : 'Order Confirmed!'}</p>
                <p className="text-sm text-gray-600 mb-4">
                  {isRtl ? 'هذا طلب سابق وتم تفعيل محتوى الباقة مباشرة.' : 'This is a legacy order whose package content was activated directly.'}
                </p>
                <Link href="/courses">
                  <Button>{isRtl ? 'إلى الكورسات' : 'Go to Courses'}</Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
