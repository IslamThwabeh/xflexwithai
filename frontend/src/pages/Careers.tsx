import { useState } from 'react';
import {
  Briefcase, Send, CheckCircle, Loader2, Upload,
  MapPin, Phone, Mail, User, FileText, ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

// Max CV file size: 5MB
const MAX_CV_SIZE = 5 * 1024 * 1024;
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function Careers() {
  const { data: jobs, isLoading } = trpc.jobs.list.useQuery();
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  if (selectedJobId) {
    return <ApplicationForm jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />;
  }

  return (
    <CinematicPublicLayout>
      <section className="relative overflow-hidden bg-[#050505] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.12),transparent_28%)]" />
        <div className="absolute left-[-3rem] top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
        <div className="absolute bottom-0 right-[-4rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />
        <div className="relative container mx-auto px-4 text-center md:px-8">
          <Badge className="mb-4 border-[#00C176]/20 bg-[#00C176]/10 px-4 py-1.5 text-sm font-medium text-[#00C176]">
            <Briefcase className="me-1.5 h-4 w-4" />
            {isRtl ? 'انضم لفريقنا' : 'Join Our Team'}
          </Badge>
          <h1 className="mb-4 text-3xl font-extrabold tracking-[-0.5px] md:text-5xl">
            {isRtl ? 'الوظائف المتاحة في أكاديمية XFlex' : 'Open Positions at XFlex Academy'}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/66">
            {isRtl ? 'نبحث عن أشخاص موهوبين وشغوفين للانضمام لفريقنا المتنامي' : 'We are looking for talented and passionate people to join our growing team'}
          </p>
        </div>
      </section>

      <section className="bg-[#050505] pb-16">
        <div className="container mx-auto px-4 md:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#00C176]" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="py-20 text-center text-white/58">
            <Briefcase className="mx-auto mb-4 h-12 w-12 text-white/24" />
            <p className="text-lg">{isRtl ? 'لا توجد وظائف متاحة حالياً' : 'No open positions at the moment'}</p>
            <p className="mt-2 text-sm">{isRtl ? 'تابعنا للحصول على آخر التحديثات' : 'Follow us for the latest updates'}</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="group overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:border-[#00C176]/20 hover:bg-white/[0.06]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00D17F_0%,#009E63_100%)] shadow-[0_18px_40px_rgba(0,193,118,0.26)]">
                  <Briefcase className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-extrabold text-white transition group-hover:text-[#00C176]">
                  {isRtl ? job.titleAr : (job.titleEn || job.titleAr)}
                </h3>
                <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-white/58">
                  {isRtl ? job.descriptionAr : (job.descriptionEn || job.descriptionAr)}
                </p>
                <button
                  onClick={() => setSelectedJobId(job.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00D17F_0%,#009E63_100%)] py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  {isRtl ? 'تقديم على الوظيفة' : 'Apply Now'}
                  <Send className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
    </CinematicPublicLayout>
  );
}

// ============================================================================
// Application Form Component
// ============================================================================

function ApplicationForm({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.jobs.getWithQuestions.useQuery({ jobId });
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const applyMutation = trpc.jobs.submitApplication.useMutation();

  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    phone: '',
    country: '',
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copy = isRtl
    ? {
        invalidCvType: 'يرجى رفع ملف بصيغة PDF أو DOC أو DOCX فقط',
        invalidCvSize: 'حجم الملف يجب ألا يتجاوز 5 ميغابايت',
        answerAll: 'يرجى الإجابة على جميع الأسئلة',
        submitError: 'حدث خطأ، يرجى المحاولة مرة أخرى',
        successTitle: 'تم إرسال طلبك بنجاح!',
        successBody: 'شكراً لتقديمك. سنراجع طلبك ونتواصل معك قريباً.',
        backToJobs: 'العودة للوظائف',
        jobNotFound: 'الوظيفة غير موجودة',
        goBack: 'العودة',
        jobApplication: 'تقديم طلب توظيف',
        basicInfo: 'المعلومات الأساسية',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'أدخل اسمك الكامل',
        email: 'البريد الإلكتروني',
        phone: 'رقم الهاتف',
        country: 'الدولة',
        countryPlaceholder: 'مثال: فلسطين',
        cvLabel: 'رفع السيرة الذاتية',
        cvHint: '(PDF / DOC / DOCX — حد أقصى 5MB)',
        chooseCv: 'اختر ملف السيرة الذاتية',
        jobQuestions: 'أسئلة الوظيفة',
        generalQuestions: 'أسئلة عامة',
        answerPlaceholder: 'اكتب إجابتك هنا...',
        submitting: 'جاري الإرسال...',
        submit: 'إرسال الطلب',
        confidentiality: 'جميع البيانات سرية وتُستخدم لغرض التوظيف فقط.',
      }
    : {
        invalidCvType: 'Please upload a PDF, DOC, or DOCX file only',
        invalidCvSize: 'The file size must not exceed 5 MB',
        answerAll: 'Please answer all questions',
        submitError: 'Something went wrong. Please try again.',
        successTitle: 'Application submitted successfully!',
        successBody: 'Thank you for applying. We will review your application and contact you soon.',
        backToJobs: 'Back to Jobs',
        jobNotFound: 'Job not found',
        goBack: 'Go Back',
        jobApplication: 'Job Application',
        basicInfo: 'Basic Information',
        fullName: 'Full name',
        fullNamePlaceholder: 'Enter your full name',
        email: 'Email address',
        phone: 'Phone number',
        country: 'Country',
        countryPlaceholder: 'Example: Palestine',
        cvLabel: 'Upload CV',
        cvHint: '(PDF / DOC / DOCX — max 5MB)',
        chooseCv: 'Choose your CV file',
        jobQuestions: 'Job Questions',
        generalQuestions: 'General Questions',
        answerPlaceholder: 'Write your answer here...',
        submitting: 'Submitting...',
        submit: 'Submit Application',
        confidentiality: 'All data is confidential and used for recruitment purposes only.',
      };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_CV_TYPES.includes(file.type)) {
      toast.error(copy.invalidCvType);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      toast.error(copy.invalidCvSize);
      e.target.value = '';
      return;
    }
    setCvFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    // Validate all questions answered
    const unanswered = data.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(copy.answerAll);
      return;
    }

    setSubmitting(true);
    try {
      let cvBase64: string | undefined;
      let cvFileName: string | undefined;
      let cvContentType: string | undefined;

      if (cvFile) {
        cvBase64 = await fileToBase64(cvFile);
        cvFileName = cvFile.name;
        cvContentType = cvFile.type;
      }

      await applyMutation.mutateAsync({
        jobId,
        applicantName: form.applicantName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim() || undefined,
        cvBase64,
        cvFileName,
        cvContentType,
        answers: data.questions.map(q => ({
          questionId: q.id,
          answer: answers[q.id]?.trim() || '',
        })),
      });

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || copy.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <CinematicPublicLayout>
        <div className="flex items-center justify-center bg-[#050505] py-32">
          <div className="text-center p-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#00C176]/12">
              <CheckCircle className="h-10 w-10 text-[#00C176]" />
            </div>
            <h2 className="mb-2 text-2xl font-extrabold text-white">
              {copy.successTitle}
            </h2>
            <p className="mb-6 text-white/58">
              {copy.successBody}
            </p>
            <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white/76 transition-all hover:bg-white/[0.08] hover:text-white">
              <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
              {copy.backToJobs}
            </button>
          </div>
        </div>
      </CinematicPublicLayout>
    );
  }

  if (isLoading) {
    return (
      <CinematicPublicLayout>
        <div className="flex items-center justify-center bg-[#050505] py-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#00C176]" />
        </div>
      </CinematicPublicLayout>
    );
  }

  if (!data) {
    return (
      <CinematicPublicLayout>
        <div className="flex items-center justify-center bg-[#050505] py-32">
          <div className="text-center">
            <p className="mb-4 text-white/58">{copy.jobNotFound}</p>
            <button onClick={onBack} className="rounded-full border border-white/12 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white/76 transition-all hover:bg-white/[0.08] hover:text-white">
              {copy.goBack}
            </button>
          </div>
        </div>
      </CinematicPublicLayout>
    );
  }

  const { job, questions } = data;
  // Separate job-specific and general questions
  const jobQuestions = questions.filter(q => q.jobId !== null);
  const generalQuestions = questions.filter(q => q.jobId === null);

  return (
    <CinematicPublicLayout>
      <section className="bg-[#050505] py-12" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="container mx-auto max-w-2xl px-4 md:px-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-all hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
          {copy.backToJobs}
        </button>

        {/* Job Info */}
        <div className="mb-8 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#047857_0%,#0f766e_100%)] p-6 text-white shadow-[0_18px_48px_rgba(0,193,118,0.22)]">
          <Badge className="mb-3 border-0 bg-white/20 text-white">{copy.jobApplication}</Badge>
          <h1 className="mb-2 text-2xl font-extrabold">{isRtl ? job.titleAr : (job.titleEn || job.titleAr)}</h1>
          <p className="text-sm leading-relaxed text-white/86">{isRtl ? job.descriptionAr : (job.descriptionEn || job.descriptionAr)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info Section */}
          <div className="rounded-[24px] border border-white/10 bg-[#F6F3EC] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-xf-dark">
              <User className="h-5 w-5 text-emerald-600" />
              {copy.basicInfo}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {copy.fullName} <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={form.applicantName}
                  onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                  placeholder={copy.fullNamePlaceholder}
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className={`inline h-3.5 w-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {copy.email} <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="text-start"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className={`inline h-3.5 w-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {copy.phone} <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+970 5XX XXX XXX"
                  dir="ltr"
                  className="text-start"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className={`inline h-3.5 w-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {copy.country}
                </label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder={copy.countryPlaceholder}
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className={`inline h-3.5 w-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {copy.cvLabel}
                  <span className={`text-xs text-gray-400 ${isRtl ? 'mr-2' : 'ml-2'}`}>{copy.cvHint}</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleCvChange}
                    className="hidden"
                    id="cv-upload"
                  />
                  <label
                    htmlFor="cv-upload"
                    className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition"
                  >
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {cvFile ? cvFile.name : copy.chooseCv}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Job-Specific Questions */}
          {jobQuestions.length > 0 && (
            <div className="rounded-[24px] border border-white/10 bg-[#F6F3EC] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-xf-dark">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                {copy.jobQuestions}
              </h2>
              <div className="space-y-5">
                {jobQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {isRtl ? q.questionAr : (q.questionEn || q.questionAr)} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder={copy.answerPlaceholder}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Questions */}
          {generalQuestions.length > 0 && (
            <div className="rounded-[24px] border border-white/10 bg-[#F6F3EC] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-xf-dark">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                {copy.generalQuestions}
              </h2>
              <div className="space-y-5">
                {generalQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {isRtl ? q.questionAr : (q.questionEn || q.questionAr)} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder={copy.answerPlaceholder}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00D17F_0%,#009E63_100%)] py-3.5 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {copy.submitting}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                {copy.submit}
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/36">
          {copy.confidentiality}
        </p>
        </div>
      </section>
    </CinematicPublicLayout>
  );
}
