import { useState, useRef } from 'react';
import { Building2, CheckCircle2, Upload, Clock, XCircle, Camera, MessageSquare, Loader2, ChevronRight, ChevronLeft, ArrowRight, BookOpen, Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';
import { Link } from 'wouter';
import { toast } from 'sonner';

const STEPS = ['select_broker', 'open_account', 'verify_account', 'deposit'] as const;
type StepKey = typeof STEPS[number];

// YouTube video guides per step (provided by Business Owner)
const STEP_VIDEOS: Partial<Record<StepKey, string>> = {
  open_account: 'rh6vI2ZCbhQ',
  // verify_account and deposit can be added when BO provides separate videos
};

function stepLabel(step: StepKey, isArabic: boolean): string {
  const labels: Record<StepKey, [string, string]> = {
    select_broker: ['اختر الوسيط', 'Select Broker'],
    open_account: ['افتح حساب', 'Open Account'],
    verify_account: ['وثّق حسابك', 'Verify Account'],
    deposit: ['أودع مبلغ', 'Make Deposit'],
  };
  return isArabic ? labels[step][0] : labels[step][1];
}

function stepDescription(step: StepKey, isArabic: boolean): string {
  const desc: Record<StepKey, [string, string]> = {
    select_broker: ['اختر وسيط التداول المفضل لديك من القائمة', 'Choose your preferred trading broker from the list'],
    open_account: ['افتح حساب تداول حقيقي وأرفق صورة إثبات', 'Open a real trading account and upload proof screenshot'],
    verify_account: ['أكمل التحقق من حسابك وأرفق صورة الإثبات', 'Complete account verification and upload proof'],
    deposit: ['أودع مبلغ 10$ على الأقل وأرفق صورة الإيداع', 'Deposit at least $10 and upload deposit proof'],
  };
  return isArabic ? desc[step][0] : desc[step][1];
}

function statusBadge(status: string, isArabic: boolean) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" />{isArabic ? 'مُعتمد' : 'Approved'}</Badge>;
    case 'pending_review':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="h-3 w-3 mr-1" />{isArabic ? 'قيد المراجعة' : 'Pending Review'}</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />{isArabic ? 'مرفوض' : 'Rejected'}</Badge>;
    default:
      return <Badge variant="outline">{isArabic ? 'لم يبدأ' : 'Not Started'}</Badge>;
  }
}

export default function BrokerOnboarding() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.onboarding.getStatus.useQuery();
  const { data: brokers, isLoading: brokersLoading } = trpc.brokers.listActive.useQuery();
  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollments.myEnrollments.useQuery();
  const selectBroker = trpc.onboarding.selectBroker.useMutation({
    onSuccess: () => {
      toast.success(isArabic ? 'تم اختيار الوسيط بنجاح' : 'Broker selected successfully');
      utils.onboarding.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitProof = trpc.onboarding.submitProof.useMutation({
    onSuccess: () => {
      toast.success(isArabic ? 'تم رفع الإثبات بنجاح' : 'Proof uploaded successfully');
      utils.onboarding.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadImage = trpc.upload.image.useMutation();

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState<StepKey | null>(null);

  // Derive step states from server data
  const stepMap = new Map<string, any>();
  (status?.steps ?? []).forEach((s: any) => stepMap.set(s.step, s));

  const currentStepKey = (status?.currentStep ?? 'select_broker') as StepKey;
  const currentStepIndex = STEPS.indexOf(currentStepKey);
  const isComplete = status?.isComplete ?? false;
  const selectedBrokerId = status?.brokerId ?? null;

  const selectedBroker = brokers?.find((b: any) => b.id === selectedBrokerId);

  const progressPercent = isComplete ? 100 : Math.round(((STEPS.indexOf(currentStepKey)) / STEPS.length) * 100);

  const handleSelectBroker = (brokerId: number) => {
    selectBroker.mutate({ brokerId });
  };

  const handleUploadProof = async (file: File, step: StepKey) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isArabic ? 'الحد الأقصى لحجم الملف 10 ميغابايت' : 'Max file size is 10MB');
      return;
    }
    setUploading(true);
    setUploadStep(step);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result?.toString() ?? '';
          const parts = result.split(',');
          resolve(parts.length > 1 ? parts[1] : result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const result = await uploadImage.mutateAsync({
        fileName: file.name,
        fileData: base64,
        contentType: file.type || 'image/jpeg',
      });

      await submitProof.mutateAsync({
        step,
        proofUrl: result.url,
        proofType: file.type,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isArabic ? 'فشل الرفع' : 'Upload failed'));
    } finally {
      setUploading(false);
      setUploadStep(null);
    }
  };

  if (isLoading || brokersLoading || enrollmentsLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </ClientLayout>
    );
  }

  // Course completion gate — student must finish all courses first
  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter((e: any) => e.completedAt !== null).length || 0;
  const allCoursesCompleted = totalCourses > 0 && completedCourses === totalCourses;
  const bestProgress = enrollments?.reduce((max: number, e: any) => Math.max(max, e.progressPercentage || 0), 0) ?? 0;

  if (!allCoursesCompleted) {
    return (
      <ClientLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {isArabic ? 'أكمل الكورس أولاً' : 'Complete the Course First'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isArabic
                  ? 'يجب إكمال دورة التداول بالكامل قبل البدء بفتح حساب الوسيط'
                  : 'You need to complete the trading course before starting your broker account setup'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalCourses > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isArabic ? 'تقدمك الحالي' : 'Your Progress'}</span>
                    <span className="font-medium">{bestProgress}%</span>
                  </div>
                  <Progress value={bestProgress} className="h-3" />
                </div>
              )}
              <Link href={enrollments?.[0] ? `/course/${enrollments[0].courseId}` : '/courses'}>
                <Button className="w-full btn-primary-xf" size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  {isArabic ? 'تابع الكورس' : 'Continue Course'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  // Completed state
  if (isComplete) {
    return (
      <ClientLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {isArabic ? 'تم إكمال التسجيل بنجاح!' : 'Onboarding Complete!'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isArabic
                  ? 'يمكنك الآن الوصول إلى LexAI وقروب التوصيات. ابدأ التداول!'
                  : 'You now have access to LexAI and Recommendations. Start trading!'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/lexai">
                <Button className="w-full btn-primary-xf" size="lg">
                  {isArabic ? 'ابدأ مع LexAI' : 'Start with LexAI'}
                </Button>
              </Link>
              <Link href="/recommendations">
                <Button variant="outline" className="w-full" size="lg">
                  {isArabic ? 'قروب التوصيات' : 'Recommendations'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            <h1 className="text-2xl font-bold">
              {isArabic ? 'تسجيل حساب الوسيط' : 'Broker Account Setup'}
            </h1>
          </div>
          <p className="text-gray-500 text-sm">
            {isArabic
              ? 'أكمل الخطوات التالية لفتح حساب تداول حقيقي والوصول إلى LexAI والتوصيات'
              : 'Complete the following steps to open a real trading account and unlock LexAI & Recommendations'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{isArabic ? 'التقدم' : 'Progress'}</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((step, i) => {
            const stepData = stepMap.get(step);
            const isApproved = stepData?.status === 'approved';
            const isCurrent = step === currentStepKey;
            const isPast = i < currentStepIndex;

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isApproved || isPast
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isApproved ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center max-w-[70px] leading-tight ${
                    isCurrent ? 'font-semibold text-emerald-700' : 'text-muted-foreground'
                  }`}>
                    {stepLabel(step, isArabic)}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${
                    isApproved || isPast ? 'bg-emerald-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {/* Step 1: Select Broker */}
          {currentStepKey === 'select_broker' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{stepLabel('select_broker', isArabic)}</CardTitle>
                <CardDescription>{stepDescription('select_broker', isArabic)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(brokers ?? []).map((broker: any) => (
                    <button
                      key={broker.id}
                      onClick={() => handleSelectBroker(broker.id)}
                      disabled={selectBroker.isPending}
                      className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left disabled:opacity-50"
                    >
                      {broker.logoUrl ? (
                        <img src={broker.logoUrl} alt={broker.nameEn} className="h-10 w-10 object-contain rounded" />
                      ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{isArabic ? broker.nameAr : broker.nameEn}</p>
                        {broker.minDeposit > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {isArabic ? `الحد الأدنى: $${broker.minDeposit}` : `Min deposit: $${broker.minDeposit}`}
                          </p>
                        )}
                      </div>
                      {selectBroker.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin ms-auto" />
                      ) : (
                        <ArrowRight className="h-4 w-4 ms-auto text-gray-300" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps 2-4: Proof upload steps */}
          {(['open_account', 'verify_account', 'deposit'] as StepKey[]).map((step) => {
            const stepData = stepMap.get(step);
            if (!stepData) return null;
            const isCurrent = step === currentStepKey;
            const isApproved = stepData.status === 'approved';
            const isPending = stepData.status === 'pending_review';
            const isRejected = stepData.status === 'rejected';
            const isNotStarted = stepData.status === 'not_started';
            const stepIndex = STEPS.indexOf(step);
            const isAccessible = stepIndex <= currentStepIndex;

            if (!isAccessible && !isApproved) return null;

            return (
              <Card key={step} className={`transition-all ${isCurrent ? 'ring-2 ring-emerald-500/30' : ''} ${isApproved ? 'bg-emerald-50/30 border-emerald-200' : ''}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{stepLabel(step, isArabic)}</CardTitle>
                      <CardDescription>{stepDescription(step, isArabic)}</CardDescription>
                    </div>
                    {statusBadge(stepData.status, isArabic)}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* YouTube video guide (if available for this step) */}
                  {STEP_VIDEOS[step] && !isApproved && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-emerald-700 mb-2">
                        {isArabic ? '📹 شاهد الفيديو التعليمي:' : '📹 Watch the guide video:'}
                      </p>
                      <div className="relative w-full rounded-xl overflow-hidden border" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full"
                          src={`https://www.youtube-nocookie.com/embed/${STEP_VIDEOS[step]}?rel=0`}
                          title="Step guide"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}

                  {/* Show selected broker info */}
                  {step === 'open_account' && selectedBroker && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4">
                      {selectedBroker.logoUrl && (
                        <img src={selectedBroker.logoUrl} alt="" className="h-8 w-8 object-contain rounded" />
                      )}
                      <span className="font-medium text-sm">{isArabic ? selectedBroker.nameAr : selectedBroker.nameEn}</span>
                      {selectedBroker.affiliateUrl && (
                        <a
                          href={selectedBroker.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-auto text-xs text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          {isArabic ? 'فتح موقع الوسيط' : 'Open Broker Site'}
                          <ChevronRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Approved — show proof thumbnail */}
                  {isApproved && stepData.proofUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={stepData.proofUrl}
                        alt="proof"
                        className="h-16 w-16 object-cover rounded-lg border cursor-pointer"
                        onClick={() => window.open(stepData.proofUrl, '_blank')}
                      />
                      <span className="text-sm text-emerald-700">{isArabic ? 'تمت الموافقة' : 'Approved'}</span>
                    </div>
                  )}

                  {/* Pending review */}
                  {isPending && (
                    <div className="text-center py-4">
                      <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {isArabic
                          ? 'تم رفع الإثبات وبانتظار مراجعة المسؤول'
                          : 'Proof uploaded — waiting for admin review'}
                      </p>
                      {stepData.proofUrl && (
                        <img
                          src={stepData.proofUrl}
                          alt="proof"
                          className="h-20 w-20 object-cover rounded-lg border mx-auto mt-3 cursor-pointer"
                          onClick={() => window.open(stepData.proofUrl, '_blank')}
                        />
                      )}
                    </div>
                  )}

                  {/* Rejected — show reason + re-upload */}
                  {isRejected && (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-700 font-medium">{isArabic ? 'سبب الرفض:' : 'Rejection reason:'}</p>
                        <p className="text-sm text-red-600 mt-1">{stepData.rejectionReason || (isArabic ? 'لم يتم تحديد سبب' : 'No reason provided')}</p>
                      </div>
                      <UploadButton
                        isArabic={isArabic}
                        uploading={uploading && uploadStep === step}
                        onFileSelect={(file) => handleUploadProof(file, step)}
                      />
                    </div>
                  )}

                  {/* Not started or current — upload form */}
                  {(isNotStarted && isCurrent) && (
                    <UploadButton
                      isArabic={isArabic}
                      uploading={uploading && uploadStep === step}
                      onFileSelect={(file) => handleUploadProof(file, step)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Support footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {isArabic ? 'تحتاج مساعدة؟' : 'Need help?'}
          </p>
          <Link href="/support">
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              {isArabic ? 'تواصل مع الدعم' : 'Contact Support'}
            </Button>
          </Link>
        </div>
      </div>
    </ClientLayout>
  );
}

// Proof upload button sub-component
function UploadButton({ isArabic, uploading, onFileSelect }: {
  isArabic: boolean;
  uploading: boolean;
  onFileSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full btn-primary-xf"
        size="lg"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isArabic ? 'جاري الرفع...' : 'Uploading...'}
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            {isArabic ? 'ارفع صورة الإثبات' : 'Upload Proof Screenshot'}
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {isArabic ? 'صورة واضحة (JPG, PNG) — الحد الأقصى 10 ميغابايت' : 'Clear screenshot (JPG, PNG) — max 10MB'}
      </p>
    </div>
  );
}
