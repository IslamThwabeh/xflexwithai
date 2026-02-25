import { useState } from 'react';
import { Link } from 'wouter';
import { BookOpen, Bot, Signal, Key, Globe, LogIn, Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ActivationModal } from '@/components/ActivationModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

export default function Home() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [showCourseActivation, setShowCourseActivation] = useState(false);
  const [showFlexAIActivation, setShowFlexAIActivation] = useState(false);
  const [showRecActivation, setShowRecActivation] = useState(false);

  // Contact support form
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');

  const contactMutation = trpc.contactSupport.useMutation();

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;

    setContactSending(true);
    setContactError('');
    try {
      await contactMutation.mutateAsync({
        email: contactEmail.trim(),
        message: contactMessage.trim(),
      });
      setContactSent(true);
      setContactEmail('');
      setContactMessage('');
      setTimeout(() => setContactSent(false), 5000);
    } catch (err: any) {
      setContactError(err.message || 'Failed to send');
    } finally {
      setContactSending(false);
    }
  };

  const services = [
    {
      key: 'course',
      icon: <BookOpen className="w-14 h-14 text-blue-600" />,
      title: t('home.service.course.title'),
      desc: t('home.service.course.desc'),
      features: [
        t('home.service.course.f1'),
        t('home.service.course.f2'),
        t('home.service.course.f3'),
        t('home.service.course.f4'),
      ],
      cta: t('home.service.course.cta'),
      price: t('home.service.course.price'),
      color: 'blue',
      borderClass: 'border-blue-200 hover:border-blue-400',
      btnClass: 'bg-blue-600 hover:bg-blue-700',
      onClick: () => setShowCourseActivation(true),
    },
    {
      key: 'rec',
      icon: <Signal className="w-14 h-14 text-emerald-600" />,
      title: t('home.service.rec.title'),
      desc: t('home.service.rec.desc'),
      features: [
        t('home.service.rec.f1'),
        t('home.service.rec.f2'),
        t('home.service.rec.f3'),
        t('home.service.rec.f4'),
      ],
      cta: t('home.service.rec.cta'),
      price: t('home.service.rec.price'),
      color: 'emerald',
      borderClass: 'border-emerald-200 hover:border-emerald-400',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700',
      onClick: () => setShowRecActivation(true),
    },
    {
      key: 'lexai',
      icon: <Bot className="w-14 h-14 text-purple-600" />,
      title: t('home.service.lexai.title'),
      desc: t('home.service.lexai.desc'),
      features: [
        t('home.service.lexai.f1'),
        t('home.service.lexai.f2'),
        t('home.service.lexai.f3'),
        t('home.service.lexai.f4'),
      ],
      cta: t('home.service.lexai.cta'),
      price: t('home.service.lexai.price'),
      color: 'purple',
      borderClass: 'border-purple-200 hover:border-purple-400',
      btnClass: 'bg-purple-600 hover:bg-purple-700',
      onClick: () => setShowFlexAIActivation(true),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Bar */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">XFlex Trading Academy</h2>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'English' : 'عربي'}
            </button>
            {/* Already Registered → Login */}
            <Link href="/auth">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LogIn className="w-4 h-4" />
                {t('home.alreadyRegistered')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          XFlex Trading Academy
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto">
          {language === 'ar'
            ? 'أتقن تداول الفوركس مع إرشاد الخبراء والتحليل بالذكاء الاصطناعي'
            : 'Master Forex Trading with Expert Guidance and AI-Powered Analysis'}
        </p>
      </section>

      {/* Services Section */}
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            {t('home.services.title')}
          </h2>
          <p className="text-gray-500">{t('home.services.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map((svc) => (
            <div
              key={svc.key}
              className={`bg-white rounded-xl shadow-md border-2 ${svc.borderClass} p-7 flex flex-col transition-all hover:shadow-lg`}
            >
              <div className="flex justify-center mb-5">{svc.icon}</div>
              <h3 className="text-xl font-bold text-center mb-2">{svc.title}</h3>
              <p className="text-sm text-gray-500 text-center mb-1">{svc.price}</p>
              <p className="text-gray-600 text-center mb-5 text-sm leading-relaxed">{svc.desc}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {svc.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${svc.btnClass} text-white`}
                size="lg"
                onClick={svc.onClick}
              >
                <Key className="w-4 h-4" />
                {svc.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Support Section */}
      <section className="bg-white border-t border-gray-200 py-14">
        <div className="container mx-auto px-4 max-w-lg text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {t('home.contact.title')}
          </h2>
          <p className="text-gray-500 mb-8">{t('home.contact.subtitle')}</p>

          {contactSent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-green-600">
              <CheckCircle className="w-10 h-10" />
              <p className="font-medium">{t('home.contact.sent')}</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4 text-start">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('home.contact.email')}
                </label>
                <Input
                  type="email"
                  dir="ltr"
                  placeholder={t('home.contact.emailPlaceholder')}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('home.contact.message')}
                </label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] resize-y"
                  placeholder={t('home.contact.messagePlaceholder')}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                />
              </div>
              {contactError && (
                <p className="text-sm text-red-600">{contactError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={contactSending}
              >
                {contactSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('home.contact.sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('home.contact.send')}
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="mb-1 text-gray-300 font-medium">XFlex Trading Academy</p>
          <p>{t('home.footer.tagline')}</p>
          <p className="mt-3">
            &copy; {new Date().getFullYear()} XFlex Trading Academy. {t('home.footer.rights')}
          </p>
        </div>
      </footer>

      {/* Activation Modals */}
      {showCourseActivation && (
        <ActivationModal
          type="course"
          onClose={() => setShowCourseActivation(false)}
          onSuccess={() => {
            setShowCourseActivation(false);
            window.location.href = '/auth?next=/courses';
          }}
        />
      )}

      {showFlexAIActivation && (
        <ActivationModal
          type="flexai"
          onClose={() => setShowFlexAIActivation(false)}
          onSuccess={() => {
            setShowFlexAIActivation(false);
            window.location.href = '/auth?next=/lexai';
          }}
        />
      )}

      {showRecActivation && (
        <ActivationModal
          type="recommendation"
          onClose={() => setShowRecActivation(false)}
          onSuccess={() => {
            setShowRecActivation(false);
            window.location.href = '/auth?next=/recommendations';
          }}
        />
      )}
    </div>
  );
}