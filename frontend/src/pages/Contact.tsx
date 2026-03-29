import { useState } from 'react';
import { Link } from 'wouter';
import { Send, CheckCircle, Loader2, Phone, Mail, MapPin, ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

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
    <div className="min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {isRtl ? 'الرئيسية' : 'Home'}
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
            {isRtl ? 'تواصل معنا' : 'Contact Us'}
          </h1>
          <p className="text-emerald-100 text-lg max-w-lg mx-auto">
            {isRtl ? 'نحن هنا لمساعدتك. أرسل لنا رسالتك وسنرد عليك في أقرب وقت.' : "We're here to help. Send us a message and we'll get back to you soon."}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 pb-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Contact Info Cards */}
          <div className="bg-white rounded-xl border p-6 text-center shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{isRtl ? 'واتساب' : 'WhatsApp'}</h3>
            <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline">
              +972 59 759 6030
            </a>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{isRtl ? 'البريد الإلكتروني' : 'Email'}</h3>
            <a href="mailto:support@xflexacademy.com" className="text-sm text-emerald-600 hover:underline">
              support@xflexacademy.com
            </a>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{isRtl ? 'الدعم الفني' : 'Live Support'}</h3>
            <Link href="/support">
              <span className="text-sm text-emerald-600 hover:underline cursor-pointer">
                {isRtl ? 'فتح محادثة الدعم' : 'Open Support Chat'}
              </span>
            </Link>
          </div>
        </div>

        {/* Contact Form */}
        <div className="max-w-xl mx-auto mt-10 bg-white rounded-xl border p-8 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-green-600">
              <CheckCircle className="w-12 h-12" />
              <p className="font-bold text-lg">{isRtl ? 'تم إرسال رسالتك بنجاح!' : 'Message sent successfully!'}</p>
              <p className="text-sm text-gray-500">{isRtl ? 'سنرد عليك في أقرب وقت ممكن' : "We'll get back to you as soon as possible"}</p>
              <Button variant="outline" size="sm" onClick={() => setSent(false)} className="mt-2">
                {isRtl ? 'إرسال رسالة أخرى' : 'Send Another Message'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {isRtl ? 'أرسل لنا رسالة' : 'Send Us a Message'}
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'البريد الإلكتروني' : 'Your Email'}
                </label>
                <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'رسالتك' : 'Your Message'}
                </label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[140px] resize-y"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isRtl ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full h-11" disabled={sending}>
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin me-2" />{isRtl ? 'جاري الإرسال...' : 'Sending...'}</>
                ) : (
                  <><Send className="w-4 h-4 me-2" />{isRtl ? 'إرسال' : 'Send Message'}</>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
