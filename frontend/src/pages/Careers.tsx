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
import PublicLayout from '@/components/PublicLayout';

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
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden text-white py-20 md:py-28" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a5f 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.12), transparent)' }} />
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/8 rounded-full blur-[100px]" />
        <div className="relative container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-white/10 text-white border-white/20 px-4 py-1.5 text-sm font-medium">
            <Briefcase className="w-4 h-4 mr-1.5" />
            {isRtl ? 'انضم لفريقنا' : 'Join Our Team'}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-[-0.5px]">
            {isRtl ? 'الوظائف المتاحة في أكاديمية XFlex' : 'Open Positions at XFlex Academy'}
          </h1>
          <p className="text-lg text-emerald-100/80 max-w-2xl mx-auto">
            {isRtl ? 'نبحث عن أشخاص موهوبين وشغوفين للانضمام لفريقنا المتنامي' : 'We are looking for talented and passionate people to join our growing team'}
          </p>
        </div>
      </section>

      {/* Job Cards */}
      <section className="container mx-auto px-4 py-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-xf-primary" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">{isRtl ? 'لا توجد وظائف متاحة حالياً' : 'No open positions at the moment'}</p>
            <p className="text-sm mt-2">{isRtl ? 'تابعنا للحصول على آخر التحديثات' : 'Follow us for the latest updates'}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="glass-card overflow-hidden group hover:shadow-lg transition-all duration-300"
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-xf-dark mb-2 group-hover:text-emerald-600 transition">
                    {isRtl ? job.titleAr : (job.titleEn || job.titleAr)}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6 line-clamp-3">
                    {isRtl ? job.descriptionAr : (job.descriptionEn || job.descriptionAr)}
                  </p>
                  <button
                    onClick={() => setSelectedJobId(job.id)}
                    className="btn-primary-xf w-full py-2.5 text-sm inline-flex items-center justify-center gap-2"
                  >
                    {isRtl ? 'تقديم على الوظيفة' : 'Apply Now'}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
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

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_CV_TYPES.includes(file.type)) {
      toast.error('يرجى رفع ملف بصيغة PDF أو DOC أو DOCX فقط');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      toast.error('حجم الملف يجب ألا يتجاوز 5 ميغابايت');
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
      toast.error('يرجى الإجابة على جميع الأسئلة');
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
      toast.error(err.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center p-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-xf-dark mb-2">
              {isRtl ? 'تم إرسال طلبك بنجاح!' : 'Application submitted successfully!'}
            </h2>
            <p className="text-gray-500 mb-6">
              {isRtl ? 'شكراً لتقديمك. سنراجع طلبك ونتواصل معك قريباً.' : 'Thank you for applying. We will review your application and contact you soon.'}
            </p>
            <button onClick={onBack} className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark hover:border-xf-dark/20 transition-all text-sm font-medium inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {isRtl ? 'العودة للوظائف' : 'Back to Jobs'}
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-xf-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!data) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{isRtl ? 'الوظيفة غير موجودة' : 'Job not found'}</p>
            <button onClick={onBack} className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark transition-all text-sm font-medium">
              {isRtl ? 'العودة' : 'Go Back'}
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const { job, questions } = data;
  // Separate job-specific and general questions
  const jobQuestions = questions.filter(q => q.jobId !== null);
  const generalQuestions = questions.filter(q => q.jobId === null);

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 rounded-full text-sm text-gray-500 hover:text-xf-dark hover:bg-gray-100/80 transition-all inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {isRtl ? 'العودة للوظائف' : 'Back to Jobs'}
        </button>

        {/* Job Info */}
        <div className="rounded-[16px] p-6 mb-8 text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #4f46e5)', boxShadow: '0 12px 40px rgba(59,130,246,0.2)' }}>
          <Badge className="bg-white/20 text-white border-0 mb-3">{isRtl ? 'تقديم طلب توظيف' : 'Job Application'}</Badge>
          <h1 className="text-2xl font-extrabold mb-2">{isRtl ? job.titleAr : (job.titleEn || job.titleAr)}</h1>
          <p className="text-emerald-100/90 text-sm leading-relaxed">{isRtl ? job.descriptionAr : (job.descriptionEn || job.descriptionAr)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info Section */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-extrabold text-xf-dark mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              {isRtl ? 'المعلومات الأساسية' : 'Basic Information'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={form.applicantName}
                  onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                  placeholder="أدخل اسمك الكامل"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-3.5 h-3.5 inline ml-1" />
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-3.5 h-3.5 inline ml-1" />
                  رقم الهاتف <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+970 5XX XXX XXX"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline ml-1" />
                  الدولة
                </label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="مثال: فلسطين"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-3.5 h-3.5 inline ml-1" />
                  رفع السيرة الذاتية
                  <span className="text-xs text-gray-400 mr-2">(PDF / DOC / DOCX — حد أقصى 5MB)</span>
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
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {cvFile ? cvFile.name : 'اختر ملف السيرة الذاتية'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Job-Specific Questions */}
          {jobQuestions.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-extrabold text-xf-dark mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                {isRtl ? 'أسئلة الوظيفة' : 'Job Questions'}
              </h2>
              <div className="space-y-5">
                {jobQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {q.questionAr} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="اكتب إجابتك هنا..."
                      dir="rtl"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Questions */}
          {generalQuestions.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-extrabold text-xf-dark mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                {isRtl ? 'أسئلة عامة' : 'General Questions'}
              </h2>
              <div className="space-y-5">
                {generalQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {q.questionAr} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="اكتب إجابتك هنا..."
                      dir="rtl"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary-xf w-full py-3.5 text-base inline-flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isRtl ? 'جاري الإرسال...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {isRtl ? 'إرسال الطلب' : 'Submit Application'}
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          {isRtl ? 'جميع البيانات سرية وتُستخدم لغرض التوظيف فقط.' : 'All data is confidential and used for recruitment purposes only.'}
        </p>
      </section>
    </PublicLayout>
  );
}
