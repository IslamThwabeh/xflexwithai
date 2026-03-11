import { useState } from 'react';
import { Link } from 'wouter';
import {
  Briefcase, Send, CheckCircle, Loader2, Upload, ChevronLeft,
  MapPin, Phone, Mail, User, FileText, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Max CV file size: 5MB
const MAX_CV_SIZE = 5 * 1024 * 1024;
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function Careers() {
  const { data: jobs, isLoading } = trpc.jobs.list.useQuery();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  if (selectedJobId) {
    return <ApplicationForm jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition cursor-pointer text-sm">
              <ChevronLeft className="w-4 h-4" />
              العودة للرئيسية
            </span>
          </Link>
          <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            XFlex Academy
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDBjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-white/10 text-white border-white/20 px-4 py-1.5 text-sm font-medium">
            <Briefcase className="w-4 h-4 ml-1.5" />
            انضم لفريقنا
          </Badge>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight">
            الوظائف المتاحة في أكاديمية XFlex
          </h1>
          <p className="text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto">
            نبحث عن أشخاص موهوبين وشغوفين للانضمام لفريقنا المتنامي
          </p>
        </div>
      </section>

      {/* Job Cards */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">لا توجد وظائف متاحة حالياً</p>
            <p className="text-sm mt-2">تابعنا للحصول على آخر التحديثات</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">
                    {job.titleAr}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">
                    {job.descriptionAr}
                  </p>
                  <Button
                    onClick={() => setSelectedJobId(job.id)}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white gap-2"
                  >
                    تقديم على الوظيفة
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} XFlex Trading Academy. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}

// ============================================================================
// Application Form Component
// ============================================================================

function ApplicationForm({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.jobs.getWithQuestions.useQuery({ jobId });
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center" dir="rtl">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم إرسال طلبك بنجاح!</h2>
          <p className="text-gray-600 mb-6">شكراً لتقديمك. سنراجع طلبك ونتواصل معك قريباً.</p>
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            العودة للوظائف
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">الوظيفة غير موجودة</p>
          <Button onClick={onBack} variant="outline">العودة</Button>
        </div>
      </div>
    );
  }

  const { job, questions } = data;
  // Separate job-specific and general questions
  const jobQuestions = questions.filter(q => q.jobId !== null);
  const generalQuestions = questions.filter(q => q.jobId === null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            العودة للوظائف
          </button>
          <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            XFlex Academy
          </span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Job Info */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-6 mb-8 shadow-lg">
          <Badge className="bg-white/20 text-white border-0 mb-3">تقديم طلب توظيف</Badge>
          <h1 className="text-2xl font-bold mb-2">{job.titleAr}</h1>
          <p className="text-blue-100/90 text-sm leading-relaxed">{job.descriptionAr}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info Section */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              المعلومات الأساسية
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
                    className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                أسئلة الوظيفة
              </h2>
              <div className="space-y-5">
                {jobQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {q.questionAr} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                أسئلة عامة
              </h2>
              <div className="space-y-5">
                {generalQuestions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {idx + 1}. {q.questionAr} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
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
          <Button
            type="submit"
            size="lg"
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white gap-2 text-base py-6 rounded-xl shadow-lg shadow-blue-500/20"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                إرسال الطلب
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          جميع البيانات سرية وتُستخدم لغرض التوظيف فقط.
        </p>
      </div>
    </div>
  );
}
