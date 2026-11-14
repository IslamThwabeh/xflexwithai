import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

type Props = {
  user: { id: number; lastSignedIn?: string | Date };
  audience: "student" | "staff" | "admin";
};

export default function InterfaceAnnouncement({ user, audience }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [saveError, setSaveError] = useState(false);
  const utils = trpc.useUtils();
  const input = {
    accountId: user.id,
    loginAt: String(user.lastSignedIn ?? "legacy-session"),
  };
  const query = trpc.interfaceAnnouncements.status.useQuery(input, {
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const action = trpc.interfaceAnnouncements.respond.useMutation({
    onSuccess: result => {
      utils.interfaceAnnouncements.status.setData(input, result);
      setSaveError(false);
    },
    onError: () => setSaveError(true),
  });
  if (!query.data?.visible) return null;
  const studentTips = ar
    ? [
        "من «تعلّمي» تصل إلى دورتك وملفاتها والاختبارات والاستبيانات.",
        "تجد LexAI والتوصيات واللايف في «الخدمات»، وأدواتك الأخرى في «المزيد».",
        "من صورة حسابك تصل إلى باقتك والتفعيل والتجديد. على الهاتف استخدم الشريط السفلي.",
      ]
    : [
        "My Learning brings together your course, documents, quizzes and surveys.",
        "Find LexAI, Recommendations and Live under Services, with other tools under More.",
        "Use your account icon for your package, activation and renewal. On mobile, use the bottom bar.",
      ];
  const workspaceTips = ar
    ? [
        "الصفحات مرتبة في مجموعات حسب طبيعة العمل. افتح المجموعة للوصول إلى أدواتك.",
        "استخدم البحث عن الصفحات أو Ctrl / Cmd + K، وثبّت الصفحات المتكررة في المفضلة.",
        audience === "staff"
          ? "للوصول إلى دورتك التدريبية، افتح «تدريب الموظفين» عند توفرها. ومن قائمة حسابك تعود إلى ملفك الشخصي."
          : "تجد إعدادات الميزات والسجلات في «النظام والإعدادات»، والتقارير في «المالية والتقارير».",
      ]
    : [
        "Work pages are organized into groups. Expand a group to reach your tools.",
        "Use page search or Ctrl / Cmd + K, and pin your frequent pages to Favorites.",
        audience === "staff"
          ? "Employee Training opens your assigned course when available. Your account menu opens your profile."
          : "Find feature settings and logs under System & Settings, and reports under Finance & Reports.",
      ];
  return (
    <aside
      className="nv2-announcement"
      aria-labelledby="navigation-update-title"
      dir={ar ? "rtl" : "ltr"}
    >
      <Sparkles className="nv2-announcement-icon" size={22} />
      <div className="min-w-0 flex-1">
        <h2 id="navigation-update-title">
          {ar
            ? "التنقّل في XFlex أصبح أسهل"
            : "Finding your way around XFlex just got easier"}
        </h2>
        <ul>
          {(audience === "student" ? studentTips : workspaceTips).map(tip => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p>
          {ar
            ? "اختر «فهمت» لإخفاء الرسالة نهائيًا، أو «ذكّرني عند الدخول القادم» لقراءتها لاحقًا."
            : "Choose Got it to hide this message permanently, or Remind me next login to read it later."}
        </p>
        {saveError && (
          <p role="alert" className="text-red-800">
            {ar
              ? "تعذر حفظ اختيارك. يرجى المحاولة مرة أخرى."
              : "Your choice could not be saved. Please try again."}
          </p>
        )}
        <div className="nv2-announcement-actions">
          <button
            type="button"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({ accountId: user.id, action: "dismiss" })
            }
          >
            {ar ? "فهمت" : "Got it"}
          </button>
          <button
            type="button"
            disabled={action.isPending}
            className="later"
            onClick={() =>
              action.mutate({ accountId: user.id, action: "later" })
            }
          >
            {ar ? "ذكّرني عند الدخول القادم" : "Remind me next login"}
          </button>
        </div>
      </div>
    </aside>
  );
}
