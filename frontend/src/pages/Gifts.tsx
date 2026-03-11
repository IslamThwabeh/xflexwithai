import { Gift, ArrowLeft, FileText, Download, ExternalLink, CalendarClock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50" dir={isRtl ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <Link href="/courses">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? "ms-2 rotate-180" : "me-2"}`} />
            {isRtl ? "العودة للوحة الطالب" : "Back to Student Dashboard"}
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
            <Gift className="w-8 h-8 text-rose-500" />
            {isRtl ? "هدايا الطلاب" : "Student Gifts"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isRtl
              ? "مجموعة موارد مختصرة تساعدك على تنظيم رحلتك التعليمية والتداولية."
              : "A compact resource bundle to keep your learning and trading journey organized."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {gifts.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className="w-5 h-5 text-rose-500" />
                    {isRtl ? item.titleAr : item.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{isRtl ? item.descriptionAr : item.descriptionEn}</p>
                  <Link href={item.actionHref}>
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="w-4 h-4" />
                      {isRtl ? item.actionLabelAr : item.actionLabelEn}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
