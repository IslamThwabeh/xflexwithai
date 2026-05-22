import { Link } from 'wouter';
import { ArrowLeft, GraduationCap, Target, Users, Award, Instagram, Facebook, Send, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

export default function About() {
  const { t, language, isRTL } = useLanguage();

  return (
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505] text-white" dir={isRTL ? 'rtl' : 'ltr'}>
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_26%)]" />
          <div className="container relative mx-auto max-w-5xl px-4 text-center md:px-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
              {language === 'ar' ? 'من نحن' : 'About XFlex'}
            </div>
            <h1 className="mb-4 mt-6 text-3xl font-extrabold tracking-[-0.5px] md:text-5xl">
              {t('home.about.title')}
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-8 text-white/66">
              {language === 'ar'
                ? 'نبني تجربة تعليم تداول أوضح وأكثر انضباطاً للمتداول العربي: مسار عملي، دعم بشري، وتحليل ذكي يساعد الطالب على اتخاذ القرار بثقة أكبر.'
                : 'We build a clearer, more disciplined trading education experience for Arab traders: a practical path, real human support, and smart analysis that helps students make decisions with more confidence.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {language === 'ar' ? '8 مراحل تعليمية' : '8 learning stages'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {language === 'ar' ? 'LexAI للتحليل الذكي' : 'LexAI smart analysis'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {language === 'ar' ? 'دعم مستمر' : 'Ongoing support'}
              </span>
            </div>
          </div>
        </section>

        <section className="pb-8">
          <div className="container mx-auto max-w-3xl px-4 md:px-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm md:p-10">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(0,193,118,0.9),rgba(0,158,99,0.9))] shadow-[0_18px_48px_rgba(0,193,118,0.28)]">
                <GraduationCap className="h-12 w-12 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">
                {language === 'ar' ? 'روان' : 'Rawan'}
              </h2>
              <p className="mb-6 text-sm text-white/46">
                {language === 'ar' ? 'مؤسسة أكاديمية XFlex للتداول' : 'Founder, XFlex Trading Academy'}
              </p>
              <p className="text-lg leading-8 text-white/68">
                {language === 'ar'
                  ? 'فلسطينية حاصلة على درجة الماجستير في المحاسبة من جامعة بيرزيت. تأسست أكاديمية XFlex من شغف حقيقي بتعليم التداول وتمكين المتداولين العرب من تحقيق أهدافهم المالية. نؤمن بأن التعليم الجيد هو الأساس لنجاح أي متداول.'
                  : 'A Palestinian with a Master\'s degree in Accounting from Birzeit University. XFlex Academy was founded from a genuine passion for trading education and empowering Arab traders to achieve their financial goals. We believe quality education is the foundation for any trader\'s success.'}
              </p>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="container mx-auto max-w-5xl px-4 md:px-8">
            <h2 className="mb-10 text-center text-2xl font-bold text-white">
              {language === 'ar' ? 'قيمنا' : 'Our Values'}
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: <Target className="h-7 w-7 text-[#00C176]" />,
                  title: language === 'ar' ? 'التعليم الشامل' : 'Comprehensive Education',
                  desc: language === 'ar'
                    ? '8 مراحل تعليمية تغطي كل ما يحتاجه المتداول من الأساسيات حتى بناء خطة التداول'
                    : '8 learning stages covering everything a trader needs from basics to building a trading plan',
                  shell: 'bg-[#00C176]/10 border-[#00C176]/16',
                },
                {
                  icon: <Users className="h-7 w-7 text-[#00C176]" />,
                  title: language === 'ar' ? 'دعم مستمر' : 'Ongoing Support',
                  desc: language === 'ar'
                    ? 'فريق دعم فني متاح لمساعدتك في كل خطوة مع توصيات تداول حية'
                    : 'Technical support team available to help you every step with live trading recommendations',
                  shell: 'bg-white/[0.05] border-white/10',
                },
                {
                  icon: <Award className="h-7 w-7 text-[#C8A96B]" />,
                  title: language === 'ar' ? 'تقنية متقدمة' : 'Advanced Technology',
                  desc: language === 'ar'
                    ? 'LexAI للتحليل الذكي بالذكاء الاصطناعي يساعدك في اتخاذ قرارات أفضل'
                    : 'LexAI for smart AI analysis helps you make better decisions',
                  shell: 'bg-[#C8A96B]/10 border-[#C8A96B]/16',
                },
              ].map((v, i) => (
                <div key={i} className={`rounded-[1.75rem] border p-6 text-center backdrop-blur-sm ${v.shell}`}>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#050505]/40">
                    {v.icon}
                  </div>
                  <h3 className="mb-2 font-bold text-white">{v.title}</h3>
                  <p className="text-sm leading-6 text-white/58">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 pt-8">
          <div className="container mx-auto px-4 text-center md:px-8">
            <h2 className="mb-6 text-2xl font-bold text-white">
              {t('home.footer.socialFollow')}
            </h2>
            <div className="mb-8 flex justify-center gap-4">
              <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-pink-400 transition hover:border-white/20 hover:bg-white/[0.08]">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#00C176] transition hover:border-white/20 hover:bg-white/[0.08]">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://t.me/+cXq1JGThuZkxNGI0" target="_blank" rel="noopener noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sky-400 transition hover:border-white/20 hover:bg-white/[0.08]">
                <Send className="h-5 w-5" />
              </a>
              <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-green-400 transition hover:border-white/20 hover:bg-white/[0.08]">
                <Phone className="h-5 w-5" />
              </a>
            </div>
            <Link href="/">
              <Button variant="outline" className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">
                <ArrowLeft className="me-1 h-4 w-4" />
                {t('home.footer.home')}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </CinematicPublicLayout>
  );
}
