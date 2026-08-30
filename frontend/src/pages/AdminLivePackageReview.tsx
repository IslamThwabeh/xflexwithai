import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Save, Send } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS, LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS } from "@shared/livePackageOwnerReview";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date(value)) : "—";

export default function AdminLivePackageReview() {
  const utils = trpc.useUtils();
  const query = trpc.livePackageOwnerReview.get.useQuery();
  const saveMutation = trpc.livePackageOwnerReview.save.useMutation();
  const submitMutation = trpc.livePackageOwnerReview.submit.useMutation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<SaveState>("idle");
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const dirtyRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!query.data || initializedRef.current) return;
    initializedRef.current = true;
    answersRef.current = query.data.answers;
    setAnswers(query.data.answers);
    setStatus(query.data.status);
    setLastSavedAt(query.data.updatedAt);
    setState("saved");
  }, [query.data]);

  const missing = useMemo(() => LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS.filter(id => !answers[id]?.trim()), [answers]);

  const flush = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const ids = [...dirtyRef.current];
    if (!ids.length) return;
    ids.forEach(id => dirtyRef.current.delete(id));
    setState("saving");
    try {
      const result = await saveMutation.mutateAsync({ answers: Object.fromEntries(ids.map(id => [id, answersRef.current[id] ?? ""])) });
      setLastSavedAt(result.savedAt); setStatus("draft"); setState(dirtyRef.current.size ? "dirty" : "saved");
    } catch {
      ids.forEach(id => dirtyRef.current.add(id)); setState("error"); toast.error("تعذر الحفظ التلقائي. حاولي مرة أخرى.");
    }
  };

  const update = (id: string, value: string) => {
    const next = { ...answersRef.current, [id]: value };
    answersRef.current = next; setAnswers(next); dirtyRef.current.add(id); setStatus("draft"); setState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 900);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const submit = async () => {
    if (missing.length) return toast.error(`أكملي ${missing.length} إجابة قبل الإرسال.`);
    if (!window.confirm("هل تريدين اعتماد الإجابات وإرسالها للمراجعة؟")) return;
    try {
      setState("saving");
      const result = await submitMutation.mutateAsync({ answers: answersRef.current });
      dirtyRef.current.clear(); setStatus("submitted"); setLastSavedAt(result.submittedAt); setState("saved");
      await utils.livePackageOwnerReview.get.invalidate(); toast.success("تم حفظ الإجابات واعتمادها للمراجعة.");
    } catch { setState("error"); toast.error("تعذر الإرسال. راجعي الإجابات وحاولي مرة أخرى."); }
  };

  if (query.isLoading) return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
  if (query.error) return <DashboardLayout><div className="p-8 text-center text-red-700">تعذر تحميل النموذج. تأكدي من تطبيق تحديث قاعدة البيانات.</div></DashboardLayout>;

  return <DashboardLayout><main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8" dir="rtl">
    <section className="rounded-3xl bg-gradient-to-br from-emerald-950 to-slate-950 p-7 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-emerald-200"><ClipboardList className="h-5 w-5" />مراجعة بكج لايف</p><h1 className="mt-2 text-3xl font-black">النقاط المتبقية لصاحبة العمل</h1><p className="mt-3 max-w-2xl leading-7 text-slate-200">نموذج قصير للقرارات النهائية فقط. تُحفظ الإجابات تلقائياً في قاعدة البيانات، ونحتفظ بسجل دائم لكل نسخة محفوظة.</p></div><Badge className={status === "submitted" ? "bg-emerald-500" : "bg-amber-400 text-slate-950"}>{status === "submitted" ? "مُرسل للمراجعة" : "مسودة محفوظة"}</Badge></div><div className="mt-5 text-sm text-slate-300">المتبقي: {missing.length} من {LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length} · آخر حفظ: {formatDate(lastSavedAt)}</div></section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><AlertTriangle className="ms-2 inline h-5 w-5" />لا تضعي بيانات عملاء أو كلمات مرور. الموافقة المكتوبة هنا تُحفظ كسجل قرار، لكنها لا تفعّل البكج أو تنشره تلقائياً.</section>
    {LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.map((question, index) => <label key={question.id} className="block rounded-2xl border bg-white p-5 shadow-sm"><span className="font-bold text-slate-900">{index + 1}. {question.text}</span><span className="mt-1 block text-sm text-slate-500">{question.hint}</span><textarea value={answers[question.id] ?? ""} onChange={event => update(question.id, event.target.value)} onBlur={() => void flush()} maxLength={5000} rows={4} placeholder="اكتبي الإجابة هنا…" className="mt-3 w-full resize-y rounded-xl border bg-slate-50 p-4 leading-7 outline-none focus:border-emerald-500 focus:bg-white" /></label>)}
    <section className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur"><span className="flex items-center gap-2 text-sm text-slate-600">{state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "error" ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{state === "saving" ? "جارٍ الحفظ…" : state === "dirty" ? "تعديلات بانتظار الحفظ" : state === "error" ? "تعذر الحفظ" : "الإجابات محفوظة"}</span><div className="flex gap-2"><Button variant="outline" onClick={() => void flush()} disabled={!dirtyRef.current.size}><Save className="h-4 w-4" />حفظ الآن</Button><Button onClick={() => void submit()} disabled={!!missing.length || submitMutation.isPending} className="bg-emerald-700"><Send className="h-4 w-4" />إرسال للمراجعة</Button></div></section>
  </main></DashboardLayout>;
}
