import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export default function ClientPasswordRecovery({ userId }: { userId: number }) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [verified, setVerified] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const mutation = trpc.auth.createSupportPasswordReset.useMutation();
  const generate = async () => {
    setError(""); setLink(""); setCopied(false);
    try {
      const result = await mutation.mutateAsync({ userId, identityVerified: true });
      const fragment = new URLSearchParams({ email: result.email, recoveryToken: result.token });
      setLink(`${window.location.origin}/auth?mode=reset#${fragment}`);
    } catch (err: any) { setError(err.message); }
  };
  return <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-4">
    <h3 className="font-semibold">{ar ? "استرداد كلمة المرور" : "Password recovery"}</h3>
    <p className="text-sm text-slate-600">{ar ? "تحقق من هوية العميل عبر قناة موثوقة قبل مشاركة الرابط. صالح لمدة 30 دقيقة ولمرة واحدة فقط. إنشاء رابط جديد يلغي السابق." : "Verify the client's identity through a trusted channel before sharing. Links expire after 30 minutes and work once. Generating a new link replaces the previous one."}</p>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1" />
      {ar ? "تحققت من هوية صاحب الحساب" : "I verified the account owner's identity"}
    </label>
    <Button type="button" disabled={!verified || mutation.isPending} onClick={generate}>{mutation.isPending ? (ar ? "جارٍ الإنشاء..." : "Generating…") : (ar ? "إنشاء رابط استرداد" : "Generate recovery link")}</Button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {link && <div className="space-y-2">
      <label htmlFor={`recovery-link-${userId}`} className="block text-sm">{ar ? "رابط الاسترداد" : "Recovery link"}</label>
      <input id={`recovery-link-${userId}`} readOnly value={link} dir="ltr" onFocus={e => e.target.select()} className="w-full rounded border p-2 text-xs" />
      <Button type="button" variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); }
        catch { setError(ar ? "انسخ الرابط يدوياً من الحقل أعلاه" : "Copy the link manually from the field above."); }
      }}>{copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ الرابط" : "Copy link")}</Button>
    </div>}
  </div>;
}
