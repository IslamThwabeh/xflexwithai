import { Gift, FileText, Download, ExternalLink, CalendarClock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import CinematicPublicLayout from "@/components/public/CinematicPublicLayout";

const gifts = [
  {
    id: "journal",
    icon: FileText,
    titleEn: "Trading Journal Template",
    titleAr: "قالب دفتر التداول",
    descriptionEn: "A clean template to track entries, exits, emotions, and lessons.",
    descriptionAr: "قالب منظم لتوثيق الدخول والخروج والمشاعر والدروس.",
    actionHref: "/articles",
    actionLabelEn: "Open Articles",
    actionLabelAr: "افتح المقالات",
  },
  {
    id: "checklist",
    icon: Download,
    titleEn: "Pre-Trade Checklist",
    titleAr: "قائمة ما قبل الصفقة",
    descriptionEn: "Quick checklist to reduce impulsive trades and keep consistency.",
    descriptionAr: "قائمة سريعة لتقليل القرارات العشوائية والحفاظ على الانضباط.",
    actionHref: "/free-content",
    actionLabelEn: "Open Free Content",
    actionLabelAr: "افتح المحتوى المجاني",
  },
  {
    id: "events",
    icon: CalendarClock,
    titleEn: "Live Event Access",
    titleAr: "الوصول للفعاليات المباشرة",
    descriptionEn: "Follow upcoming sessions, webinars, and special campaigns.",
    descriptionAr: "تابع الجلسات والندوات والحملات الخاصة القادمة.",
    actionHref: "/events",
    actionLabelEn: "View Events",
    actionLabelAr: "عرض الفعاليات",
  },
];

export default function Gifts() {
  const { language } = useLanguage();
  const isRtl = language === "ar";

  return (
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505]" dir={isRtl ? "rtl" : "ltr"}>
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_28%)]" />
          <div className="absolute left-[-5rem] top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
          <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />

          <div className="relative container mx-auto max-w-5xl px-4 md:px-8">
            <div className="mx-auto max-w-3xl text-center text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
                {isRtl ? 'الهدايا' : 'Gifts'}
              </div>
              <h1 className="mt-6 flex items-center justify-center gap-3 text-3xl font-extrabold tracking-[-0.03em] md:text-5xl">
                <Gift className="h-8 w-8 text-[#00C176] md:h-10 md:w-10" />
                {isRtl ? 'هدايا عملية للمتداول' : 'Practical gifts for traders'}
              </h1>
              <p className="mt-5 text-base leading-8 text-white/62 md:text-lg">
                {isRtl
                  ? 'هذه الصفحة تجمع موارد سريعة ومباشرة تساعدك على التنظيم والانضباط والمتابعة من دون أن تتحول الصفحة الرئيسية إلى مساحة طويلة ومزدحمة.'
                  : 'This page keeps a few practical resources close at hand without forcing the homepage itself to become a long utility hub.'}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#050505] pb-16">
          <div className="container mx-auto max-w-5xl px-4 md:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              {gifts.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.id} className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] text-white shadow-none backdrop-blur-sm">
                    <CardHeader className="space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C176]/12">
                        <Icon className="h-5 w-5 text-[#00C176]" />
                      </div>
                      <CardTitle className="text-lg leading-snug text-white">
                        {isRtl ? item.titleAr : item.titleEn}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-5 text-sm leading-7 text-white/60">
                        {isRtl ? item.descriptionAr : item.descriptionEn}
                      </p>
                      <Link href={item.actionHref}>
                        <Button variant="outline" className="w-full rounded-full border-white/12 bg-white/[0.04] text-white hover:border-[#00C176]/30 hover:bg-white/[0.08] hover:text-white">
                          <ExternalLink className="h-4 w-4" />
                          {isRtl ? item.actionLabelAr : item.actionLabelEn}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </CinematicPublicLayout>
  );
}
