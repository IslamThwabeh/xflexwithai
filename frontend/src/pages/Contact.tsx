import { useState } from 'react';
import { Link } from 'wouter';
import { Send, CheckCircle, Loader2, Phone, Mail, MessageCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

export default function Contact() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const contactMutation = trpc.contactSupport.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      await contactMutation.mutateAsync({ email: email.trim(), message: message.trim() });
      setSent(true);
      setEmail('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505]" dir={isRtl ? 'rtl' : 'ltr'}>
        <section className="relative overflow-hidden py-20 text-white md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_30%)]" />
          <div className="absolute left-[-5rem] top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
          <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />

          <div className="relative container mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
                {isRtl ? 'تواصل معنا' : 'Contact'}
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.03em] md:text-5xl">
                {isRtl ? 'اسأل مباشرة بدل أن تبقى محتارًا' : 'Ask directly instead of staying uncertain'}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/62 md:text-lg">
                {isRtl
                  ? 'إذا كنت مترددًا بين الباقات، تحتاج توضيحًا حول التسجيل، أو تريد توجيهًا سريعًا قبل البدء، أرسل لنا رسالتك وسيرد عليك الفريق بأسرع شكل ممكن.'
                  : 'If you are unsure which package fits, need clarification before registering, or want a quick direction before starting, send a message and the team will reply as quickly as possible.'}
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-sm transition hover:border-[#00C176]/22 hover:bg-white/[0.06]"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C176]/12">
                  <Phone className="h-5 w-5 text-[#00C176]" />
                </div>
                <h2 className="text-lg font-semibold text-white">{isRtl ? 'واتساب' : 'WhatsApp'}</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {isRtl ? 'للاستفسارات السريعة قبل التسجيل أو بعده.' : 'For quick questions before or after registration.'}
                </p>
                <p className="mt-4 text-sm font-semibold text-[#00C176]">+972 59 759 6030</p>
              </a>

              <a
                href="mailto:support@xflexacademy.com"
                className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-sm transition hover:border-[#00C176]/22 hover:bg-white/[0.06]"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Mail className="h-5 w-5 text-white/82" />
                </div>
                <h2 className="text-lg font-semibold text-white">{isRtl ? 'البريد الإلكتروني' : 'Email'}</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {isRtl ? 'للمتابعات التي تحتاج تفاصيل أو ملفات مرفقة.' : 'For follow-ups that need more detail or attached files.'}
                </p>
                <p className="mt-4 text-sm font-semibold text-[#C8A96B]">support@xflexacademy.com</p>
              </a>

              <Link href="/auth?next=/support">
                <a className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-sm transition hover:border-[#00C176]/22 hover:bg-white/[0.06]">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C8A96B]/14">
                    <MessageCircle className="h-5 w-5 text-[#C8A96B]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{isRtl ? 'الدعم داخل الحساب' : 'In-account support'}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    {isRtl ? 'ادخل إلى حسابك إذا كنت تحتاج متابعة مرتبطة باشتراكك أو دوراتك.' : 'Sign in if you need help tied to your subscription or course access.'}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#00C176]">
                    {isRtl ? 'تسجيل الدخول للدعم' : 'Sign in for support'}
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </a>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#050505] pb-16">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-white backdrop-blur-sm md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                  {isRtl ? 'ماذا يحدث بعد الإرسال؟' : 'What happens after you send?'}
                </p>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">
                  {isRtl ? 'نرد عليك بوضوح ثم نوجّهك للخطوة التالية' : 'We reply clearly, then point you to the next step'}
                </h2>
                <div className="mt-6 space-y-4 text-sm leading-7 text-white/62">
                  <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                    {isRtl
                      ? 'إذا كان سؤالك عن الباقات، نوضح لك الفرق بين Basic و Comprehensive بدون إطالة أو تعقيد.'
                      : 'If your question is about packages, we clarify the difference between Basic and Comprehensive without dragging you through unnecessary detail.'}
                  </div>
                  <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                    {isRtl
                      ? 'إذا كان الموضوع تقنيًا، نوجّهك للطريق الأسرع: تسجيل دخول، تفعيل مفتاح، أو متابعة داخل الحساب.'
                      : 'If the issue is technical, we point you to the fastest route: sign in, activate a key, or continue inside your account.'}
                  </div>
                  <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                    {isRtl
                      ? 'إذا كنت تفضّل سرعة أعلى، استخدم واتساب مباشرة. وإذا أردت شرحًا مرتبًا، استخدم النموذج أدناه.'
                      : 'If you want the fastest reply, use WhatsApp directly. If you want a structured explanation, use the form on this page.'}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white backdrop-blur-sm md:p-8">
                {sent ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C176]/14">
                      <CheckCircle className="h-9 w-9 text-[#00C176]" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-[-0.03em]">
                      {isRtl ? 'تم إرسال رسالتك بنجاح' : 'Your message was sent successfully'}
                    </h2>
                    <p className="max-w-md text-sm leading-7 text-white/62">
                      {isRtl ? 'وصلت رسالتك إلى الفريق. إذا كان الموضوع عاجلًا، يمكنك أيضًا مراسلتنا عبر واتساب.' : 'Your message reached the team. If the matter is urgent, you can also message us on WhatsApp.'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSent(false)}
                      className="mt-2 rounded-full border-white/12 bg-white/[0.04] text-white hover:border-[#00C176]/30 hover:bg-white/[0.08] hover:text-white"
                    >
                      {isRtl ? 'إرسال رسالة أخرى' : 'Send another message'}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
                        {isRtl ? 'أرسل رسالتك' : 'Send your message'}
                      </p>
                      <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-white">
                        {isRtl ? 'نموذج بسيط وواضح' : 'A simple, clear form'}
                      </h2>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/76">
                        {isRtl ? 'البريد الإلكتروني' : 'Your email'}
                      </label>
                      <Input
                        type="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/76">
                        {isRtl ? 'رسالتك' : 'Your message'}
                      </label>
                      <textarea
                        className="min-h-[180px] w-full resize-y rounded-[1.4rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={isRtl ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                        required
                      />
                    </div>

                    {error ? <p className="text-sm text-red-300">{error}</p> : null}

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(0,193,118,0.28)] hover:from-emerald-500 hover:to-teal-600"
                      disabled={sending}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          {isRtl ? 'جاري الإرسال...' : 'Sending...'}
                        </>
                      ) : (
                        <>
                          <Send className="me-2 h-4 w-4" />
                          {isRtl ? 'إرسال الرسالة' : 'Send message'}
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </CinematicPublicLayout>
  );
}
