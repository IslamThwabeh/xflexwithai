import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

/** Guidance only: opening the checklist never saves a financial sign-off. */
export default function FinancePeriodChecklist({
  netExpensesMinor,
}: {
  netExpensesMinor: number;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  return (
    <aside className={`space-y-3 rounded-xl border p-4 text-sm ${netExpensesMinor === 0 ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      <p>
        {netExpensesMinor === 0
          ? ar
            ? "صافي المصروفات المعتمدة لهذه الفترة صفر. قد تكون المصروفات غير مدخلة أو بانتظار الاعتماد، أو قابلتها قيود تصحيح؛ الصفر لا يثبت عدم وجود مصروفات."
            : "Net approved expenses for this period are zero. Expenses may be unrecorded, awaiting approval, or offset by corrections; zero does not establish that no expenses occurred."
          : ar
            ? "النتيجة تشمل المصروفات المدخلة والمعتمدة للفترة بعد تصحيحاتها؛ المصروفات غير المسجلة أو غير المعتمدة لا تدخل فيها."
            : "This result includes recorded, approved period expenses after corrections. Unrecorded or unapproved expenses are excluded."}
      </p>
      <p>
        {ar
          ? "هذه نتيجة تشغيلية نقدية وفق السجلات المتاحة، وليست إثباتاً لاكتمال الربح أو مطابقة مستقلة مع البنك."
          : "This is an operating cash result from available records. It does not certify complete profit or independent bank reconciliation."}
      </p>
      <details>
        <summary className="cursor-pointer font-semibold">
          {ar ? "قائمة مراجعة نهاية الشهر" : "Month-end review checklist"}
        </summary>
        <ol className="mt-3 list-decimal space-y-2 ps-5">
          <li>
            {ar
              ? "ثبّت الفترة ونطاق كل الخدمات، ثم حدّث التقرير وسجّل وقت عرضه قبل المقارنة."
              : "Apply the period and All services scope, refresh, and note the report time before comparing figures."}
          </li>
          <li>
            <Link
              className="font-semibold underline"
              href="/admin/finance/expenses"
            >
              {ar ? "راجع سجل المصروفات" : "Review the expense register"}
            </Link>
            {ar
              ? ": أدخل المصروفات المدفوعة بتواريخها وأدلتها، وأرسل المسودات للمراجعة المستقلة وتأكد من اعتماد المستحق منها."
              : ": record paid expenses with their dates and evidence, submit drafts for independent review, and check which should be approved."}
          </li>
          <li>
            {ar
              ? "طابق المقبوضات والاستردادات والمصروفات مع البنك والصندوق؛ وثّق الفروقات ولا تنشئ تسوية لمجرد جعل الرقم مطابقاً."
              : "Compare receipts, refunds and expenses with bank/cash records. Document differences; do not post an adjustment just to force a match."}
          </li>
          <li>
            <Link
              className="font-semibold underline"
              href="/admin/finance/reconciliation"
            >
              {ar
                ? "راجع البنود التاريخية غير المحسومة"
                : "Review unresolved historical items"}
            </Link>
            {ar
              ? " دون اعتبار مبالغها المقترحة دفعات مؤكدة."
              : " without treating proposed amounts as confirmed payments."}
          </li>
          <li>
            {ar
              ? "بعد المراجعة والتصحيحات الموثقة، حدّث التقرير مجدداً. إقفال الفترة إجراء منفصل للمالك؛ فتح هذه القائمة لا يثبت اكتمال المراجعة."
              : "After documented reviews/corrections, refresh again. Period locking is a separate owner action; opening this checklist does not certify completion."}
          </li>
        </ol>
      </details>
    </aside>
  );
}
