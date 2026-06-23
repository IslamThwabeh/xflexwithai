import { Link } from "wouter";
import { BookOpenCheck, ShieldAlert, UserRoundCheck } from "lucide-react";
import CinematicPublicLayout from "@/components/public/CinematicPublicLayout";
import { useLanguage } from "@/contexts/LanguageContext";

type TrustPage = "editorial" | "risk" | "author";

const content = {
  editorial: {
    icon: BookOpenCheck,
    titleAr: "السياسة التحريرية والتحقق من المحتوى",
    titleEn: "Editorial and fact-checking policy",
    introAr: "نكتب المحتوى التعليمي لمساعدة القارئ على الفهم واتخاذ قرار أكثر وعياً، لا لدفعه إلى صفقة أو وعده بنتيجة مالية.",
    introEn: "We publish educational content to improve understanding and decision quality—not to push a trade or promise a financial result.",
    sectionsAr: [
      ["الكتابة والمراجعة", "تُراجع المواد من حيث الوضوح، الاتساق، الإفصاح عن المخاطر، والتمييز بين الحقائق والرأي أو الخبرة العملية."],
      ["المصادر والتحديث", "نفضّل المصادر الأولية والرسمية عند عرض معلومات قابلة للتحقق، ونوضح تاريخ النشر والتحديث للمحتوى الذي يتغير مع الوقت."],
      ["التصحيحات", "عند اكتشاف خطأ جوهري نصححه بوضوح، ونحدّث المحتوى أو نسحبه إذا لم يعد دقيقاً أو مناسباً."],
      ["الاستقلالية", "لا نعرض النتائج الانتقائية كدليل على أرباح مستقبلية، ولا نخفي علاقة تجارية مؤثرة على توصية أو مراجعة."],
    ],
    sectionsEn: [
      ["Writing and review", "Material is reviewed for clarity, internal consistency, risk disclosure, and separation of fact from opinion or practical experience."],
      ["Sources and updates", "We prefer primary and official sources for verifiable claims and show publication or update dates where information can change."],
      ["Corrections", "Material errors are corrected clearly. Content is updated or withdrawn when it is no longer accurate or appropriate."],
      ["Independence", "We do not present selected results as evidence of future profits or hide commercial relationships that materially affect a recommendation."],
    ],
  },
  risk: {
    icon: ShieldAlert,
    titleAr: "إفصاح مخاطر التداول",
    titleEn: "Trading risk disclosure",
    introAr: "التداول والمضاربة ينطويان على مخاطر مرتفعة، وقد تخسر جزءاً من رأس المال أو كله. لا توجد استراتيجية أو أداة أو خدمة تضمن الربح.",
    introEn: "Trading and speculation involve substantial risk. You may lose part or all of your capital, and no strategy, tool, or service can guarantee profit.",
    sectionsAr: [
      ["محتوى تعليمي", "المواد والدورات والمقالات وأدوات LexAI لأغراض تعليمية ومعلوماتية عامة، وليست نصيحة استثمارية أو مالية شخصية."],
      ["مسؤولية القرار", "أنت مسؤول عن تقييم ملاءمة أي قرار لوضعك المالي وخبرتك وقدرتك على تحمل الخسارة، والاستعانة بمختص مرخص عند الحاجة."],
      ["الأداء السابق", "النتائج السابقة أو أمثلة الصفقات لا تتنبأ بنتائج المستقبل، وقد تختلف ظروف السوق والتنفيذ والسيولة بشكل كبير."],
      ["الأدوات الآلية والذكاء الاصطناعي", "قد تخطئ الأدوات أو تسيء قراءة البيانات أو تنتج مخرجات غير مكتملة. يجب التحقق البشري وإدارة المخاطر دائماً."],
    ],
    sectionsEn: [
      ["Educational content", "Courses, articles, examples, and LexAI tools are general educational information—not personalized investment or financial advice."],
      ["Decision responsibility", "You are responsible for judging suitability based on your finances, experience, and ability to absorb loss, and for consulting a licensed professional where needed."],
      ["Past performance", "Past results and trade examples do not predict future outcomes. Market, execution, and liquidity conditions can vary materially."],
      ["Automation and AI", "Automated or AI tools can misread data and produce incomplete or incorrect outputs. Human verification and risk controls remain necessary."],
    ],
  },
  author: {
    icon: UserRoundCheck,
    titleAr: "فريق XFlex التحريري",
    titleEn: "XFlex editorial team",
    introAr: "هذا الملف يوضح مسؤولية الجهة التحريرية عن المقالات والمواد العامة المنشورة باسم أكاديمية XFlex.",
    introEn: "This profile explains the editorial responsibility behind public articles and educational material published by XFlex Trading Academy.",
    sectionsAr: [
      ["المسؤوليات", "إعداد المحتوى التعليمي، مراجعة بنية الشرح، إضافة إفصاحات المخاطر، متابعة التحديثات وتصحيح الأخطاء."],
      ["نطاق الخبرة", "تعليم أساسيات التداول، التحليل الفني، إدارة رأس المال، علم نفس التداول، وتقييم خدمات التوصيات والأدوات المساندة."],
      ["حدود الدور", "الفريق لا يقدم عبر المقالات نصيحة مالية شخصية ولا يضمن نتيجة تداول أو عائداً مستقبلياً."],
      ["التواصل", "يمكن إرسال ملاحظات المحتوى أو طلبات التصحيح عبر صفحة التواصل الرسمية."],
    ],
    sectionsEn: [
      ["Responsibilities", "Educational writing, structural review, risk disclosures, content maintenance, and correction of material errors."],
      ["Coverage", "Trading foundations, technical analysis, capital management, trading psychology, signals, and supporting analytical tools."],
      ["Role limits", "Public articles do not provide personalized financial advice or guarantee any trading result or future return."],
      ["Contact", "Content feedback and correction requests can be submitted through the official contact page."],
    ],
  },
} satisfies Record<TrustPage, unknown>;

export default function TrustCenter({ page }: { page: TrustPage }) {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const item = content[page] as (typeof content)[TrustPage];
  const Icon = item.icon;
  const sections = isRtl ? item.sectionsAr : item.sectionsEn;

  return (
    <CinematicPublicLayout>
      <main className="min-h-screen bg-[#050505] px-4 py-20 text-white md:py-28">
        <article className="mx-auto max-w-4xl">
          <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            {isRtl ? item.titleAr : item.titleEn}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/68">
            {isRtl ? item.introAr : item.introEn}
          </p>
          <div className="mt-12 grid gap-5">
            {sections.map(([title, body]) => (
              <section key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
                <h2 className="text-xl font-bold">{title}</h2>
                <p className="mt-3 leading-8 text-white/64">{body}</p>
              </section>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3 text-sm">
            <Link href={isRtl ? "/ar/contact" : "/en/contact"} className="rounded-full bg-emerald-500 px-5 py-2.5 font-semibold text-white">
              {isRtl ? "تواصل معنا" : "Contact us"}
            </Link>
            <Link href={isRtl ? "/ar/risk-disclosure" : "/en/risk-disclosure"} className="rounded-full border border-white/15 px-5 py-2.5 text-white/80">
              {isRtl ? "إفصاح المخاطر" : "Risk disclosure"}
            </Link>
            <Link href={isRtl ? "/ar/editorial-policy" : "/en/editorial-policy"} className="rounded-full border border-white/15 px-5 py-2.5 text-white/80">
              {isRtl ? "السياسة التحريرية" : "Editorial policy"}
            </Link>
          </div>
        </article>
      </main>
    </CinematicPublicLayout>
  );
}
