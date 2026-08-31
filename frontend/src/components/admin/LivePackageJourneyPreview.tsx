import { useState } from 'react';
import { Bot, CheckCircle, Home, ReceiptText, ShieldCheck, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type PreviewStage = 'home' | 'registration' | 'accounting';

type PreviewData = {
  package?: { nameEn?: string | null; nameAr?: string | null; descriptionEn?: string | null; descriptionAr?: string | null } | null;
  availability: { errors: string[] };
};

const standardPackages = [
  { id: 'basic', icon: ShieldCheck, ar: 'الباقة الأساسية', en: 'Basic', price: '₪700' },
  { id: 'comprehensive', icon: Bot, ar: 'الباقة الشاملة', en: 'Comprehensive', price: '₪1,750' },
] as const;

export default function LivePackageJourneyPreview({ data, isAr }: { data: PreviewData; isAr: boolean }) {
  const [stage, setStage] = useState<PreviewStage>('home');
  const [registrationStep, setRegistrationStep] = useState(1);
  const [client, setClient] = useState({
    name: isAr ? 'عميل تجريبي' : 'Demo Client',
    email: 'client@example.com',
    phone: '05X-XXX-XXXX',
    city: isAr ? 'رام الله' : 'Ramallah',
    country: isAr ? 'فلسطين' : 'Palestine',
    password: 'DemoPass123',
    confirmPassword: 'DemoPass123',
    notes: '',
    accepted: false,
  });
  const packageName = isAr ? data.package?.nameAr || 'بكج لايف' : data.package?.nameEn || 'Live Package';
  const packageDescription = isAr ? data.package?.descriptionAr : data.package?.descriptionEn;
  const tabs = [
    { id: 'home' as const, icon: Home, label: isAr ? 'الصفحة الرئيسية' : 'Homepage' },
    { id: 'registration' as const, icon: UserPlus, label: isAr ? 'تسجيل العميل' : 'Client registration' },
    { id: 'accounting' as const, icon: ReceiptText, label: isAr ? 'تقرير المحاسبة' : 'Accounting report' },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-dashed border-violet-300 bg-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-violet-100 px-5 py-3 text-sm font-bold text-violet-950">
        <span>{isAr ? 'معاينة رحلة العميل — لا يتم حفظ أو إرسال أي بيانات' : 'Client journey preview — no data is saved or submitted'}</span>
        <Badge variant="outline" className="border-violet-300 bg-white text-violet-800">{isAr ? 'للإدارة فقط' : 'Admin only'}</Badge>
      </div>
      <div className="grid gap-2 border-b p-3 md:grid-cols-3">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" onClick={() => setStage(id)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${stage === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {stage === 'home' && (
        <div className="bg-[#0A0A0A] p-5 md:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isAr ? 'اختر مسارك' : 'Choose your path'}</p><h2 className="mt-3 text-3xl font-extrabold text-white">{isAr ? 'مسارات واضحة. قرار واحد.' : 'Clear package paths. One decision.'}</h2></div>
            <div className="grid gap-5 md:grid-cols-2">
              {standardPackages.map(({ id, icon: Icon, ar, en, price }) => (
                <article key={id} className={`rounded-3xl border p-6 ${id === 'comprehensive' ? 'border-[#00C176]/30 bg-gradient-to-b from-[#00C176]/[0.09] to-[#050505]' : 'border-white/10 bg-white/[0.04]'}`}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/55"><Icon className="h-4 w-4" />{isAr ? 'مسار تعليمي' : 'Learning path'}</div>
                  <h3 className="mt-5 text-2xl font-extrabold text-white">{isAr ? ar : en}</h3><p className="mt-5 text-4xl font-extrabold text-[#00C176]">{price}</p><div className="mt-6 h-11 rounded-full bg-white/90" />
                </article>
              ))}
              {/* This mirrors the full-width Live card already used by CinematicHomePage. */}
              <article className="rounded-3xl border border-[#C8A96B]/30 bg-gradient-to-br from-[#C8A96B]/10 to-[#050505] p-6 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-6"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">{isAr ? 'بكج مؤقت ومحدود' : 'Limited educational cohort'}</p><h3 className="mt-3 text-3xl font-extrabold text-white">{packageName}</h3><p className="mt-3 text-sm leading-7 text-white/60">{packageDescription || (isAr ? 'لقاءان تعليميان مباشران مجدولان أسبوعياً، مع وصول دائم للدورات الأساسية.' : 'Two scheduled educational Live sessions per week, with permanent access to assigned base courses.')}</p></div><div><p className="text-4xl font-extrabold text-[#00C176]">₪2,000</p><p className="mt-1 text-xs text-white/45">{isAr ? 'شامل الضريبة' : 'VAT inclusive'}</p></div></div>
                <button type="button" className="mt-6 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white">{isAr ? 'اشترك الآن' : 'View Live Package'}</button>
              </article>
            </div>
          </div>
        </div>
      )}

      {stage === 'registration' && (
        <div className="bg-[#050505] p-5 md:p-8"><div className="mx-auto max-w-5xl rounded-[28px] bg-[var(--color-xf-cream)] p-5 md:p-7">
          <div className="mb-6 grid grid-cols-3 gap-2">{[isAr ? 'إنشاء حساب' : 'Create account', isAr ? 'إكمال الطلب' : 'Place order', isAr ? 'رفع الإيصال' : 'Upload receipt'].map((label, index) => <button key={label} type="button" onClick={() => setRegistrationStep(index + 1)} className={`rounded-xl px-2 py-3 text-xs font-bold ${registrationStep === index + 1 ? 'bg-emerald-700 text-white' : 'border bg-white text-slate-600'}`}>{index + 1}. {label}</button>)}</div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-[24px] border bg-white p-6 shadow-sm">
              {registrationStep === 1 && <div className="space-y-4"><h3 className="font-bold">{isAr ? 'إنشاء حساب XFlex' : 'Create an XFlex account'}</h3><div><Label>{isAr ? 'الاسم الكامل' : 'Full name'}</Label><Input className="mt-1" value={client.name} onChange={event => setClient({ ...client, name: event.target.value })} /></div><div><Label>{isAr ? 'البريد الإلكتروني' : 'Email'}</Label><Input className="mt-1" dir="ltr" value={client.email} onChange={event => setClient({ ...client, email: event.target.value })} /></div><div><Label>{isAr ? 'الهاتف' : 'Phone'}</Label><Input className="mt-1" dir="ltr" value={client.phone} onChange={event => setClient({ ...client, phone: event.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>{isAr ? 'المدينة' : 'City'}</Label><Input className="mt-1" value={client.city} onChange={event => setClient({ ...client, city: event.target.value })} /></div><div><Label>{isAr ? 'الدولة' : 'Country'}</Label><Input className="mt-1" value={client.country} onChange={event => setClient({ ...client, country: event.target.value })} /></div></div><div><Label>{isAr ? 'كلمة المرور' : 'Password'}</Label><Input className="mt-1" dir="ltr" type="password" value={client.password} onChange={event => setClient({ ...client, password: event.target.value })} /></div><div><Label>{isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}</Label><Input className="mt-1" dir="ltr" type="password" value={client.confirmPassword} onChange={event => setClient({ ...client, confirmPassword: event.target.value })} /></div><Button className="w-full" onClick={() => setRegistrationStep(2)}>{isAr ? 'متابعة' : 'Continue'}</Button></div>}
              {registrationStep === 2 && <div className="space-y-4"><div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4"><p className="font-bold">{isAr ? 'حوالة بنكية' : 'Bank transfer'}</p><p className="text-xs text-slate-500">{isAr ? 'يرفع العميل الإيصال بعد إنشاء الطلب.' : 'The client uploads the receipt after creating the order.'}</p></div><div><Label>{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label><Textarea className="mt-1" value={client.notes} onChange={event => setClient({ ...client, notes: event.target.value })} /></div><label className="flex gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={client.accepted} onChange={event => setClient({ ...client, accepted: event.target.checked })} /><span>{isAr ? 'أوافق على الشروط وسياسة عدم الاسترداد.' : 'I accept the Terms and non-refundable policy.'}</span></label><Button className="w-full" disabled={!client.accepted} onClick={() => setRegistrationStep(3)}>{isAr ? 'إتمام الطلب التجريبي' : 'Place demo order'}</Button></div>}
              {registrationStep === 3 && <div className="space-y-4 text-center"><CheckCircle className="mx-auto h-12 w-12 text-emerald-700" /><h3 className="text-xl font-bold">{isAr ? 'تم إنشاء الطلب' : 'Order created'}</h3><p className="text-sm leading-7 text-slate-600">{isAr ? 'يرفع العميل الإيصال، ثم ينتظر تأكيد الدفع ومفتاح التفعيل.' : 'The client uploads the receipt, then waits for payment approval and the activation key.'}</p><div className="rounded-xl border-2 border-dashed p-5 text-sm text-slate-500">{isAr ? 'رفع صورة أو PDF للإيصال' : 'Receipt image or PDF upload'}</div><Button variant="outline" onClick={() => setRegistrationStep(1)}>{isAr ? 'إعادة المعاينة' : 'Restart preview'}</Button></div>}
            </div>
            <aside className="h-fit rounded-[24px] border bg-white p-5 shadow-sm"><h3 className="font-bold">{isAr ? 'ملخص الطلب' : 'Order summary'}</h3><p className="mt-4 font-bold">{packageName}</p><p className="text-xs text-slate-500">{client.email}</p><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>{isAr ? 'قبل الضريبة' : 'Subtotal'}</span><span>₪1,724.14</span></div><div className="flex justify-between"><span>VAT 16%</span><span>₪275.86</span></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>{isAr ? 'الإجمالي' : 'Total'}</span><span>₪2,000</span></div></div></aside>
          </div>
        </div></div>
      )}

      {stage === 'accounting' && (
        <div className="bg-slate-50 p-5 md:p-8"><div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">{isAr ? 'بيانات مثالية فقط: البيع يدخل المحاسبة بعد تأكيد الدفع وتفعيل المفتاح، وليس بمجرد إنشاء الطلب.' : 'Sample data only: a sale enters accounting after payment approval and key activation, not merely when the order is created.'}</div>
          <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{isAr ? 'إجمالي المبيعات' : 'Gross sales'}</p><p className="mt-2 text-3xl font-bold">₪2,000</p></div><div className="rounded-xl border border-rose-200 bg-white p-5"><p className="text-sm text-rose-700">{isAr ? 'المسترد' : 'Refunded'}</p><p className="mt-2 text-3xl font-bold text-rose-700">₪0</p></div><div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white"><p className="text-sm">{isAr ? 'صافي الدخل' : 'Net income'}</p><p className="mt-2 text-3xl font-bold">₪2,000</p></div></div>
          <div className="rounded-xl border bg-white p-5"><h3 className="font-bold">{isAr ? 'الإيرادات حسب الباقة' : 'Revenue by package'}</h3><div className="mt-4 flex items-center justify-between border-t pt-4"><div><p className="font-medium">{packageName}</p><p className="text-xs text-slate-500">1 {isAr ? 'مفتاح مفعل' : 'activated key'}</p></div><p className="font-bold text-emerald-700">₪2,000</p></div></div>
          <div className="overflow-x-auto rounded-xl border bg-white p-5"><h3 className="mb-4 font-bold">{isAr ? 'سجل التفعيلات' : 'Activation ledger'}</h3><table className="min-w-[680px] w-full text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 text-start">{isAr ? 'المفتاح' : 'Key'}</th><th className="px-3 py-2 text-start">{isAr ? 'العميل' : 'Client'}</th><th className="px-3 py-2 text-start">{isAr ? 'الباقة' : 'Package'}</th><th className="px-3 py-2">{isAr ? 'الإجمالي' : 'Gross'}</th><th className="px-3 py-2">{isAr ? 'الصافي' : 'Net'}</th></tr></thead><tbody><tr><td className="px-3 py-3 font-mono text-xs">XFLEX-LIVE-DEMO</td><td className="px-3 py-3"><p>{client.name}</p><p className="text-xs text-slate-500">{client.email}</p></td><td className="px-3 py-3">{packageName}</td><td className="px-3 py-3 text-center">₪2,000</td><td className="px-3 py-3 text-center font-bold text-emerald-700">₪2,000</td></tr></tbody></table></div>
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle className="h-5 w-5 shrink-0" /><span>{isAr ? 'يظهر بكج لايف في فلتر الباقات وملفات CSV/PDF بعد أول تفعيل حقيقي.' : 'Live Package appears in the package filter and CSV/PDF output after the first real activation.'}</span></div>
        </div></div>
      )}
    </section>
  );
}
