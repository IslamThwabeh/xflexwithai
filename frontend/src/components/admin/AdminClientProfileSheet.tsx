import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  ShieldAlert,
  TrendingUp,
  UserRound,
} from "lucide-react";

type AdminClientProfileSheetProps = {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLexai?: (caseId: number | null) => void;
  onOpenSupport?: (conversationId: number | null) => void;
};

function formatDate(value: string | null | undefined, locale: string, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(
    locale,
    includeTime
      ? {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
  );
}

function getServiceBadgeClass(state: string | null | undefined) {
  switch (state) {
    case "active":
      return "bg-emerald-100 text-emerald-800";
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "pending_activation":
      return "bg-teal-100 text-teal-800";
    case "expired":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getServiceLabel(state: string | null | undefined, isRtl: boolean) {
  switch (state) {
    case "active":
      return isRtl ? "نشط" : "Active";
    case "paused":
      return isRtl ? "مجمّد" : "Frozen";
    case "pending_activation":
      return isRtl ? "بانتظار التفعيل" : "Pending Activation";
    case "expired":
      return isRtl ? "منتهي" : "Expired";
    case "inactive":
      return isRtl ? "غير نشط" : "Inactive";
    default:
      return isRtl ? "لا يوجد اشتراك" : "No Subscription";
  }
}

function getDisplayName(profile: any, isRtl: boolean) {
  if (profile?.user?.name) return profile.user.name;
  if (profile?.user?.email) return profile.user.email;
  if (profile?.user?.id == null) return isRtl ? "عميل محذوف" : "Deleted Client";
  return isRtl ? `عميل محذوف #${profile.user.id}` : `Deleted Client #${profile.user.id}`;
}

function getSecondaryLabel(profile: any, isRtl: boolean) {
  if (profile?.user?.email) return profile.user.email;
  return isRtl ? "السجل الأصلي لهذا العميل لم يعد موجوداً" : "Original client record no longer exists";
}

function getLoginSecurityModeLabel(mode: string | null | undefined, isRtl: boolean) {
  switch (mode) {
    case "password_only":
      return isRtl ? "كلمة المرور فقط" : "Password Only";
    case "password_plus_otp":
      return isRtl ? "كلمة المرور ثم رمز الدخول" : "Password + OTP";
    case "password_or_otp":
      return isRtl ? "كلمة المرور أو رمز الدخول" : "Password or OTP";
    default:
      return isRtl ? "غير معروف" : "Unknown";
  }
}

function getUserTypeLabel(userType: string | null | undefined, isStaff: boolean, isRtl: boolean) {
  if (isStaff) return isRtl ? "موظف" : "Staff";
  switch (userType) {
    case "telegram":
      return isRtl ? "تيليجرام" : "Telegram";
    case "web":
      return isRtl ? "ويب" : "Web";
    default:
      return isRtl ? "غير محدد" : "Unspecified";
  }
}

function getMigrationToneClasses(tone: "healthy" | "attention" | "risk") {
  switch (tone) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "risk":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

export default function AdminClientProfileSheet({
  userId,
  open,
  onOpenChange,
  onOpenLexai,
  onOpenSupport,
}: AdminClientProfileSheetProps) {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const locale = isRtl ? "ar-EG" : "en-US";

  const { data, isLoading, error } = trpc.clientProfiles.getProfile.useQuery(
    { userId: userId ?? 0 },
    {
      enabled: open && userId != null,
      staleTime: 30_000,
      retry: false,
    },
  );

  const profile = data;
  const displayName = getDisplayName(profile, isRtl);
  const secondaryLabel = getSecondaryLabel(profile, isRtl);
  const packageCount = profile?.packageSummary?.activePackages?.length ?? 0;
  const lexaiCaseId = profile?.lexaiCase?.id ?? null;
  const supportConversationId = profile?.supportConversation?.id ?? null;
  const keySummary = profile?.keySummary ?? {
    assignedPackageKeys: 0,
    activatedPackageKeys: 0,
    latestActivatedAt: null,
  };
  const lexaiState = profile?.lexaiSubscription?.subscriptionState ?? "no_subscription";
  const recommendationState = profile?.recommendationSubscription?.subscriptionState ?? "no_subscription";
  const hasPendingService = lexaiState === "pending_activation" || recommendationState === "pending_activation";
  const hasActiveService = lexaiState === "active" || recommendationState === "active";
  const hasServiceRecord = !!profile?.lexaiSubscription || !!profile?.recommendationSubscription;
  const migrationChecks: Array<{ title: string; detail: string; tone: "healthy" | "attention" | "risk" }> = [];

  if (profile?.user?.adminEmailCollision) {
    migrationChecks.push({
      tone: "risk",
      title: isRtl ? "تعارض بريد مع مسؤول" : "Admin Email Collision",
      detail: isRtl
        ? "نفس البريد موجود أيضاً في جدول المدراء. يجب مراجعة مسار الدخول حتى لا يضيع العميل بين /auth و /admin/login."
        : "This email also exists in the separate admins table. Review the login path so the client is not split between /auth and /admin/login.",
    });
  }

  if (keySummary.assignedPackageKeys === 0) {
    migrationChecks.push({
      tone: "attention",
      title: isRtl ? "لا يوجد مفتاح باقة نشط" : "No Active Package Key",
      detail: isRtl
        ? "لم يتم ربط أي مفتاح باقة نشط بهذا البريد بعد. ابدأ بتعيين المفتاح الصحيح قبل أي خطوات أخرى."
        : "No active package key is linked to this email yet. Assign the correct key before taking any other migration action.",
    });
  } else if (keySummary.activatedPackageKeys === 0) {
    migrationChecks.push({
      tone: "attention",
      title: isRtl ? "المفتاح معيّن لكنه غير مفعّل" : "Key Assigned But Not Activated",
      detail: isRtl
        ? "يوجد مفتاح باقة لهذا البريد لكنه لم يُفعّل بعد. الخطوة التالية للعميل هي التفعيل أو التحقق من حسابه."
        : "A package key exists for this email but has not been activated yet. The next client step is activation or account verification.",
    });
  } else {
    migrationChecks.push({
      tone: "healthy",
      title: isRtl ? "المفتاح تم تفعيله" : "Key Activated",
      detail: isRtl
        ? "يوجد على الأقل مفتاح باقة مفعّل لهذا البريد."
        : "There is at least one activated package key tied to this email.",
    });
  }

  if (keySummary.activatedPackageKeys > 0 && packageCount === 0) {
    migrationChecks.push({
      tone: "risk",
      title: isRtl ? "التفعيل موجود لكن الباقة مفقودة" : "Activation Present But Package Missing",
      detail: isRtl
        ? "هناك مفتاح مفعّل بدون باقة نشطة في الملف. هذا يشير غالباً إلى حاجة مزامنة أو إصلاح للـ entitlements."
        : "There is an activated key but no active package in the profile. This usually means the entitlements need a sync or repair.",
    });
  } else if (packageCount > 0) {
    migrationChecks.push({
      tone: "healthy",
      title: isRtl ? "الباقة النشطة موجودة" : "Active Package Present",
      detail: isRtl
        ? "الوصول الأساسي للدورة موجود الآن، لذلك يجب أن تُفتح الملفات ولوحة الباقة."
        : "Core course access is present, so documents and the package area should be unlocked.",
    });
  }

  if (profile?.user?.brokerOnboardingComplete && packageCount === 0) {
    migrationChecks.push({
      tone: "risk",
      title: isRtl ? "الوسيط مكتمل بدون باقة" : "Broker Complete Without Package",
      detail: isRtl
        ? "تم تعليم الوسيط كمكتمل لكن لا توجد باقة نشطة. راجع ترتيب الخطوات أو أصلح entitlements أولاً."
        : "Broker status is complete but there is no active package. Review the action order or repair entitlements first.",
    });
  } else if (hasPendingService && !profile?.user?.brokerOnboardingComplete) {
    migrationChecks.push({
      tone: "attention",
      title: isRtl ? "الخدمات بانتظار الوسيط" : "Services Are Waiting On Broker",
      detail: isRtl
        ? "هناك اشتراكات بانتظار التفعيل. إذا كان العميل أنهى خطوات الوسيط خارج النظام، استخدم تخطي الوسيط لا تخطي الدورة."
        : "Some services are pending activation. If the client already completed broker steps outside the system, use broker skip rather than course skip.",
    });
  } else if (profile?.user?.brokerOnboardingComplete && hasPendingService) {
    migrationChecks.push({
      tone: "risk",
      title: isRtl ? "الوسيط مكتمل لكن الخدمات ما زالت معلّقة" : "Broker Complete But Services Still Pending",
      detail: isRtl
        ? "حالة الوسيط مكتملة بينما LexAI أو التوصيات ما زالت بانتظار التفعيل. هذا يحتاج مراجعة أو إصلاح للحالة."
        : "Broker status is complete while LexAI or Recommendations are still pending. This needs a state review or repair.",
    });
  } else if (profile?.user?.brokerOnboardingComplete && hasServiceRecord && hasActiveService) {
    migrationChecks.push({
      tone: "healthy",
      title: isRtl ? "الخدمات الزمنية نشطة" : "Timed Services Active",
      detail: isRtl
        ? "حالة الوسيط والخدمات الزمنية متطابقة حالياً."
        : "Broker state and timed-service access currently line up.",
    });
  }

  if (!profile?.user?.emailVerified) {
    migrationChecks.push({
      tone: "attention",
      title: isRtl ? "البريد غير موثّق بعد" : "Email Not Verified Yet",
      detail: isRtl
        ? "هذا لا يمنع تسجيل الدخول دائماً، لكنه يعني أن العميل لم يثبت بريده بعد داخل الموقع."
        : "This does not always block login, but it means the client has not yet verified the email inside the website.",
    });
  }

  const openLexai = () => {
    if (onOpenLexai) {
      onOpenLexai(lexaiCaseId);
      return;
    }
    setLocation(lexaiCaseId ? `/admin/lexai?caseId=${lexaiCaseId}` : "/admin/lexai");
  };

  const openSupport = () => {
    if (onOpenSupport) {
      onOpenSupport(supportConversationId);
      return;
    }
    setLocation(supportConversationId ? `/admin/support?conversationId=${supportConversationId}` : "/admin/support");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        dir={isRtl ? "rtl" : "ltr"}
        className="w-full gap-0 overflow-hidden border-slate-200 bg-[var(--color-xf-cream)] p-0 sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-emerald-100 bg-white/90">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <UserRound className="h-5 w-5 text-emerald-600" />
            {isRtl ? "ملف العميل" : "Client Profile"}
          </SheetTitle>
          <SheetDescription>
            {isRtl
              ? "سياق العميل والخدمات والدعم في مكان واحد، مع إبقاء السجل الزمني خاضعاً للصلاحية."
              : "Client context, service state, and support summary in one place, with timeline access still permission-gated."}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-full items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <div className="p-4">
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="p-4 text-sm text-rose-700">
                {isRtl ? "تعذر تحميل ملف العميل حالياً. حاول مرة أخرى." : "The client profile could not be loaded right now. Please try again."}
              </CardContent>
            </Card>
          </div>
        ) : !profile ? (
          <div className="p-4">
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {isRtl ? "لا توجد بيانات متاحة لهذا العميل." : "No client data is available for this record."}
              </CardContent>
            </Card>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              <Card className="border-emerald-100 bg-white/95">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-xl">{displayName}</CardTitle>
                      <CardDescription className="mt-1">{secondaryLabel}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profile.user.isDeleted && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          {isRtl ? "سجل محذوف" : "Deleted Record"}
                        </Badge>
                      )}
                      {profile.user.emailVerified && (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                          {isRtl ? "البريد موثّق" : "Email Verified"}
                        </Badge>
                      )}
                      <Badge className={profile.user.brokerOnboardingComplete ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}>
                        <Building2 className="me-1 h-3.5 w-3.5" />
                        {profile.user.brokerOnboardingComplete
                          ? (isRtl ? "الوسيط مكتمل" : "Broker Complete")
                          : (isRtl ? "الوسيط غير مكتمل" : "Broker Pending")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoLine icon={<Mail className="h-4 w-4 text-emerald-600" />} label={isRtl ? "البريد" : "Email"} value={profile.user.email || "-"} />
                    <InfoLine icon={<Phone className="h-4 w-4 text-emerald-600" />} label={isRtl ? "الهاتف" : "Phone"} value={profile.user.phone || "-"} />
                    <InfoLine icon={<MapPin className="h-4 w-4 text-emerald-600" />} label={isRtl ? "الموقع" : "Location"} value={[profile.user.city, profile.user.country].filter(Boolean).join(", ") || "-"} />
                    <InfoLine icon={<Clock3 className="h-4 w-4 text-emerald-600" />} label={isRtl ? "آخر دخول" : "Last Sign-In"} value={formatDate(profile.user.lastSignedIn, locale)} />
                    <InfoLine icon={<Package className="h-4 w-4 text-emerald-600" />} label={isRtl ? "الباقات النشطة" : "Active Packages"} value={String(packageCount)} />
                    <InfoLine icon={<Clock3 className="h-4 w-4 text-emerald-600" />} label={isRtl ? "تاريخ التسجيل" : "Registered"} value={formatDate(profile.user.createdAt, locale)} />
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-[var(--color-xf-cream)] p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {isRtl ? "ملخص الباقة" : "Package Summary"}
                    </p>
                    {packageCount === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {isRtl ? "لا توجد باقات نشطة حالياً." : "No active packages right now."}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {profile.packageSummary.activePackages.map((pkg: any) => (
                          <div key={pkg.subscriptionId} className="rounded-xl border border-white bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge className="bg-emerald-100 text-emerald-800">
                                <Package className="me-1 h-3.5 w-3.5" />
                                {isRtl ? pkg.nameAr : pkg.nameEn}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {isRtl ? "بدأ" : "Started"}: {formatDate(pkg.startDate, locale, false)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-white/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    {isRtl ? "جاهزية الترحيل" : "Migration Health"}
                  </CardTitle>
                  <CardDescription>
                    {isRtl
                      ? "ملخص سريع لما إذا كان العميل جاهزاً للدخول والوصول، وما هي الخطوة التالية لفريق الدعم."
                      : "A quick summary of login and access readiness, plus the next support action for this client."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    <p className="font-medium">{isRtl ? "الترتيب المعتمد" : "Approved Order"}</p>
                    <p className="mt-1 text-xs leading-6 text-amber-800">
                      {isRtl
                        ? "المسار الصحيح للعملاء المرحّلين هو: المفتاح أولاً، ثم تخطي الوسيط فقط إذا كان العميل أنهى خطوات الوسيط خارج الموقع، ثم التأكد من لوحة الطالب والملفات وLexAI والتوصيات. تخطي الدورة يحدّث حالة الدورة فقط ويحافظ على التقدم الحقيقي."
                        : "The correct path for migrated clients is: key first, then broker skip only if the client already completed broker steps outside the site, then verify the dashboard, documents, LexAI, and Recommendations. Course skip only updates the course status and preserves real progress."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoLine
                      icon={<Mail className="h-4 w-4 text-emerald-600" />}
                      label={isRtl ? "وضع الدخول" : "Login Mode"}
                      value={getLoginSecurityModeLabel(profile.user.loginSecurityMode, isRtl)}
                    />
                    <InfoLine
                      icon={<UserRound className="h-4 w-4 text-emerald-600" />}
                      label={isRtl ? "مصدر الحساب" : "Account Source"}
                      value={getUserTypeLabel(profile.user.userType, profile.user.isStaff, isRtl)}
                    />
                    <InfoLine
                      icon={<Package className="h-4 w-4 text-emerald-600" />}
                      label={isRtl ? "مفاتيح الباقات" : "Package Keys"}
                      value={isRtl
                        ? `${keySummary.activatedPackageKeys} مفعّل من ${keySummary.assignedPackageKeys}`
                        : `${keySummary.activatedPackageKeys} of ${keySummary.assignedPackageKeys} activated`}
                    />
                    <InfoLine
                      icon={<Clock3 className="h-4 w-4 text-emerald-600" />}
                      label={isRtl ? "آخر تفعيل مفتاح" : "Latest Key Activation"}
                      value={formatDate(keySummary.latestActivatedAt, locale, false)}
                    />
                  </div>

                  <div className="space-y-2">
                    {migrationChecks.map((item, index) => (
                      <div key={`${item.title}-${index}`} className={`rounded-xl border px-3 py-3 ${getMigrationToneClasses(item.tone)}`}>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 opacity-90">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <ServiceCard
                  icon={<Bot className="h-5 w-5 text-emerald-600" />}
                  title={isRtl ? "LexAI" : "LexAI"}
                  description={isRtl ? "الحالة الحالية والوصول وسياق المتابعة." : "Current access state and follow-up context."}
                  state={profile.lexaiSubscription?.subscriptionState ?? "no_subscription"}
                  stateLabel={getServiceLabel(profile.lexaiSubscription?.subscriptionState, isRtl)}
                  badgeClass={getServiceBadgeClass(profile.lexaiSubscription?.subscriptionState)}
                  rows={[
                    { label: isRtl ? "الأيام المتبقية" : "Remaining Days", value: String(profile.lexaiSubscription?.remainingDays ?? 0) },
                    { label: isRtl ? "سبب التجميد" : "Freeze Reason", value: profile.lexaiSubscription?.pausedReason || "-" },
                  ]}
                />

                <ServiceCard
                  icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
                  title={isRtl ? "التوصيات" : "Recommendations"}
                  description={isRtl ? "وضع الاشتراك والتجميد والانتهاء." : "Subscription, freeze, and expiry state."}
                  state={profile.recommendationSubscription?.subscriptionState ?? "no_subscription"}
                  stateLabel={getServiceLabel(profile.recommendationSubscription?.subscriptionState, isRtl)}
                  badgeClass={getServiceBadgeClass(profile.recommendationSubscription?.subscriptionState)}
                  rows={[
                    { label: isRtl ? "الأيام المتبقية" : "Remaining Days", value: String(profile.recommendationSubscription?.remainingDays ?? 0) },
                    { label: isRtl ? "سبب التجميد" : "Freeze Reason", value: profile.recommendationSubscription?.pausedReason || "-" },
                    { label: isRtl ? "تاريخ الانتهاء" : "End Date", value: formatDate(profile.recommendationSubscription?.endDate ?? null, locale, false) },
                  ]}
                />
              </div>

              <Card className="border-teal-100 bg-white/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-5 w-5 text-teal-600" />
                    {isRtl ? "الدعم المرتبط" : "Linked Support"}
                  </CardTitle>
                  <CardDescription>
                    {isRtl ? "آخر محادثة دعم مرتبطة بهذا العميل." : "The most recent support thread for this client."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {profile.supportConversation ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">#{profile.supportConversation.id}</Badge>
                        <Badge className={profile.supportConversation.status === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                          {profile.supportConversation.status === "open"
                            ? (isRtl ? "مفتوحة" : "Open")
                            : (isRtl ? "مغلقة" : "Closed")}
                        </Badge>
                        {profile.supportConversation.needsHuman && (
                          <Badge className="bg-amber-100 text-amber-800">
                            <ShieldAlert className="me-1 h-3.5 w-3.5" />
                            {isRtl ? "بحاجة رد بشري" : "Needs Human"}
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoLine label={isRtl ? "آخر تحديث" : "Last Updated"} value={formatDate(profile.supportConversation.updatedAt, locale)} />
                        <InfoLine label={isRtl ? "أغلق في" : "Closed At"} value={formatDate(profile.supportConversation.closedAt, locale)} />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      {isRtl ? "لا توجد محادثة دعم مرتبطة بهذا العميل حالياً." : "There is no linked support conversation for this client right now."}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-amber-100 bg-white/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ExternalLink className="h-5 w-5 text-amber-600" />
                    {isRtl ? "إجراءات سريعة" : "Quick Actions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={openLexai} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700">
                    <Bot className="me-2 h-4 w-4" />
                    {isRtl ? "فتح مساحة LexAI" : "Open LexAI Workspace"}
                  </Button>
                  <Button variant="outline" onClick={openSupport} disabled={!profile.supportConversation}>
                    <MessageSquare className="me-2 h-4 w-4" />
                    {isRtl ? "فتح الدعم" : "Open Support"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-emerald-100 bg-white/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock3 className="h-5 w-5 text-emerald-600" />
                    {isRtl ? "السجل الزمني" : "Timeline"}
                  </CardTitle>
                  <CardDescription>
                    {isRtl ? "التفعيل والتسجيل والأحداث التعليمية المرتبطة بالعميل." : "Activation, enrollment, and learning events tied to the client."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!profile.permissions.canViewTimeline ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {isRtl
                        ? "عرض السجل الزمني يحتاج صلاحية مشاهدة التقدم. بقية سياق الخدمة ما زال متاحاً لك هنا."
                        : "Viewing the timeline requires the View Progress permission. The rest of the service context is still available here."}
                    </div>
                  ) : profile.timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {isRtl ? "لا توجد أحداث زمنية بعد." : "No timeline events yet."}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {profile.timeline.map((event: any, index: number) => (
                        <div key={`${event.type}-${event.date}-${index}`} className="relative ps-5">
                          <span className="absolute start-0 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <p className="text-sm font-medium">{isRtl ? event.labelAr : event.labelEn}</p>
                          {event.details && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{event.details}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date, locale)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  description,
  state,
  stateLabel,
  badgeClass,
  rows,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  state: string;
  stateLabel: string;
  badgeClass: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <Card className="border-emerald-100 bg-white/95">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge className={badgeClass}>{stateLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={`${state}-${row.label}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[var(--color-xf-cream)] px-3 py-2">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className="text-sm font-medium text-slate-800">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}