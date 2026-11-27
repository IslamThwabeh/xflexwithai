import { useLanguage } from "@/contexts/LanguageContext";

export default function KeyActivityDefinitions() {
  const { language } = useLanguage();
  const ar = language === "ar";
  return (
    <details className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold">
        {ar
          ? "لماذا تختلف أعداد المفاتيح والتفعيلات؟"
          : "Why do key and activation counts differ?"}
      </summary>
      <ul className="mt-3 list-disc space-y-2 ps-5">
        <li>
          {ar
            ? "إجمالي مفاتيح الباقات في لوحة التحكم: كل سجلات المفاتيح المرتبطة بباقة، بما فيها غير المستخدمة والمعطلة."
            : "Package keys — total on the home page counts every key record linked to a package, including unused and deactivated keys."}
        </li>
        <li>
          {ar
            ? "عدد المفاتيح المفعلة حالياً في إحصاءات المفاتيح: لها تاريخ تفعيل وعلامة المفتاح نشط. هذا لا يثبت أن جميع الخدمات المحددة المدة لم تنتهِ."
            : "The current activated-key statistic requires an activation date and an active key flag. It does not establish that every timed service is still unexpired."}
        </li>
        <li>
          {ar
            ? "نشاط التفعيل: مفاتيح الباقات التي لها تاريخ تفعيل، حتى لو عُطلت لاحقاً؛ يُعرض تاريخ التفعيل المحفوظ لكل مفتاح، وليس سجل كل محاولة تفعيل. فلاتر هذا التقرير وحدّ عرضه قد تغيّر العدد الظاهر."
            : "Activation activity includes package keys with a stored activation date, even if later deactivated. It shows the saved activation date per key, not every activation attempt. Report filters and the display cap affect the visible count."}
        </li>
        <li>
          {ar
            ? "هذه مؤشرات وصول وتشغيل؛ أي عدد مفاتيح أو تفعيلات لا يساوي مبيعات أو دفعات مؤكدة."
            : "These are access/operations indicators. Key or activation counts do not establish sales or confirmed payments."}
        </li>
      </ul>
    </details>
  );
}
