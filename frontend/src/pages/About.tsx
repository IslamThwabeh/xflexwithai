import { Link } from 'wouter';
import { ChevronRight, Globe, ArrowLeft, GraduationCap, Target, Users, Award, Instagram, Facebook, Send, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function About() {
  const { t, language, setLanguage, isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Nav */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-emerald-600 bg-clip-text text-transparent cursor-pointer">
              XFlex
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link href="/">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('home.footer.home')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-emerald-950 to-emerald-950 text-white py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            {t('home.about.title')}
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-200/60">
            <Link href="/"><span className="hover:text-white cursor-pointer">{t('home.footer.home')}</span></Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white">{t('home.footer.aboutUs')}</span>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {language === 'ar' ? 'روان' : 'Rawan'}
            </h2>
            <p className="text-gray-500">
              {language === 'ar' ? 'مؤسسة أكاديمية XFlex للتداول' : 'Founder, XFlex Trading Academy'}
            </p>
          </div>

          <div className="prose prose-gray max-w-none text-center">
            <p className="text-lg text-gray-600 leading-relaxed">
              {language === 'ar'
                ? 'فلسطينية حاصلة على درجة الماجستير في المحاسبة من جامعة بيرزيت. تأسست أكاديمية XFlex من شغف حقيقي بتعليم التداول وتمكين المتداولين العرب من تحقيق أهدافهم المالية. نؤمن بأن التعليم الجيد هو الأساس لنجاح أي متداول.'
                : 'A Palestinian with a Master\'s degree in Accounting from Birzeit University. XFlex Academy was founded from a genuine passion for trading education and empowering Arab traders to achieve their financial goals. We believe quality education is the foundation for any trader\'s success.'}
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            {language === 'ar' ? 'قيمنا' : 'Our Values'}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Target className="w-7 h-7 text-emerald-600" />,
                title: language === 'ar' ? 'التعليم الشامل' : 'Comprehensive Education',
                desc: language === 'ar'
                  ? '8 مراحل تعليمية تغطي كل ما يحتاجه المتداول من الأساسيات حتى بناء خطة التداول'
                  : '8 learning stages covering everything a trader needs from basics to building a trading plan',
                bg: 'bg-emerald-50',
              },
              {
                icon: <Users className="w-7 h-7 text-emerald-600" />,
                title: language === 'ar' ? 'دعم مستمر' : 'Ongoing Support',
                desc: language === 'ar'
                  ? 'فريق دعم فني متاح لمساعدتك في كل خطوة مع توصيات تداول حية'
                  : 'Technical support team available to help you every step with live trading recommendations',
                bg: 'bg-emerald-50',
              },
              {
                icon: <Award className="w-7 h-7 text-amber-600" />,
                title: language === 'ar' ? 'تقنية متقدمة' : 'Advanced Technology',
                desc: language === 'ar'
                  ? 'LexAI للتحليل الذكي بالذكاء الاصطناعي يساعدك في اتخاذ قرارات أفضل'
                  : 'LexAI for smart AI analysis helps you make better decisions',
                bg: 'bg-amber-50',
              },
            ].map((v, i) => (
              <div key={i} className="text-center p-6">
                <div className={`w-14 h-14 ${v.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                  {v.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social / Contact */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('home.footer.socialFollow')}
          </h2>
          <div className="flex justify-center gap-4 mb-8">
            <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-xl bg-pink-50 hover:bg-pink-100 flex items-center justify-center transition">
              <Instagram className="w-5 h-5 text-pink-600" />
            </a>
            <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition">
              <Facebook className="w-5 h-5 text-emerald-600" />
            </a>
            <a href="https://t.me/+cXq1JGThuZkxNGI0" target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-xl bg-sky-50 hover:bg-sky-100 flex items-center justify-center transition">
              <Send className="w-5 h-5 text-sky-600" />
            </a>
            <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-xl bg-green-50 hover:bg-green-100 flex items-center justify-center transition">
              <Phone className="w-5 h-5 text-green-600" />
            </a>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 me-1" />
              {t('home.footer.home')}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="mb-1 text-gray-300 font-medium">XFlex Trading Academy</p>
          <p>&copy; {new Date().getFullYear()} XFlex Trading Academy. {t('home.footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
