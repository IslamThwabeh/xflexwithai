import { ReactNode, useEffect, useRef, useState } from "react";
import ClientNavigation from "./navigation/ClientNavigation";
import InterfaceAnnouncement from "./navigation/InterfaceAnnouncement";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEngagementTracker } from "@/_core/hooks/useEngagementTracker";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { trpc } from "@/lib/trpc";
import { getStaffLandingPage } from "@shared/const";
import { LIVE_EXPERT_ROLE } from "@shared/liveExpert";
import {
  Sparkles,
  MessageSquare,
  LayoutDashboard,
  Headphones,
  BookOpen,
  Package,
  FileText,
  ClipboardCheck,
  Bell,
  Award,
  Calculator,
  Building2,
  Briefcase,
  Key,
  Radio,
} from "lucide-react";

interface ClientLayoutProps {
  children: ReactNode;
  /** Optional extra content shown below the main nav (e.g. course progress bar) */
  subHeader?: ReactNode;
}

function getPreferredLanguageFromNotificationPrefs(notificationPrefs: string | null | undefined): "ar" | "en" | null {
  try {
    const prefs = JSON.parse(notificationPrefs || "{}");
    return prefs.language === "en" || prefs.language === "ar" ? prefs.language : null;
  } catch {
    return null;
  }
}

// Only in-flight language choices live here, scoped to the authenticated account.
// Routed layout remounts must not hydrate an older preference while saving it.
const pendingClientLanguages = new Map<number, { language: "ar" | "en" }>();

export default function ClientLayout({ children, subHeader }: ClientLayoutProps) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const { track } = useEngagementTracker();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [location] = useLocation();

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const lastInteractionAtRef = useRef(0);
  const hydratedLanguageForUserIdRef = useRef<number | null>(null);

  const { data: unreadNotifData } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 120_000, refetchIntervalInBackground: false });
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery(undefined, { retry: false });
  const { data: surveyAvailability } = trpc.studentSurveys.availability.useQuery(undefined, { retry: false });
  const { data: communityAvailability } = trpc.community.availability.useQuery(undefined, { retry: false });
  const { data: jobEligibilityAvailability } = trpc.studentJobEligibility.availability.useQuery(undefined, { retry: false });
  const { data: livePackageAccess } = trpc.livePackage.myWorkspace.useQuery(undefined, { retry: false });
  const touchInteractionMutation = trpc.users.touchInteraction.useMutation();
  const cacheLanguage = (accountId: number, nextLanguage: "ar" | "en") => {
    utils.auth.me.setData(undefined, current => {
      if (!current || current.id !== accountId) return current;
      let preferences: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(current.notificationPrefs || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          preferences = parsed as Record<string, unknown>;
        }
      } catch { /* Invalid legacy preferences are treated like an empty object. */ }
      return { ...current, notificationPrefs: JSON.stringify({ ...preferences, language: nextLanguage }) };
    });
  };
  const updateNotificationPrefsMutation = trpc.users.updateNotificationPrefs.useMutation({
    onMutate: () => ({ accountId: user?.id, intent: user ? pendingClientLanguages.get(user.id) : undefined }),
    onSuccess: async (_result, _input, context) => {
      if (!context?.accountId || !context.intent) return;
      // Revalidate once after saving, keeping the intent until stale reads settle.
      // Identity/permissions still come from the normal authenticated endpoint.
      await utils.auth.me.invalidate();
      if (pendingClientLanguages.get(context.accountId) !== context.intent) return;
      cacheLanguage(context.accountId, context.intent.language);
      pendingClientLanguages.delete(context.accountId);
    },
    onError: (_error, _input, context) => {
      if (context?.accountId && pendingClientLanguages.get(context.accountId) === context.intent) {
        pendingClientLanguages.delete(context.accountId);
      }
    },
  });
  const unreadNotifCount = unreadNotifData?.count ?? 0;
  const showStudentSurveysNav = surveyAvailability?.enabled === true && surveyAvailability.access === "student";
  const showCommunityNav =
    communityAvailability?.enabled === true
    && communityAvailability.access === "allowed";
  const showJobEligibilityNav = jobEligibilityAvailability?.enabled === true;
  const showLiveExpertInbox = adminCheck?.isAdmin === true
    || (adminCheck?.isStaff === true && adminCheck.staffRoles?.some(role => role === LIVE_EXPERT_ROLE));
  const staffWorkspacePath = adminCheck?.isStaff && !adminCheck?.isAdmin
    ? getStaffLandingPage(adminCheck.staffRoles ?? [])
    : null;

  useEffect(() => {
    if (!user?.id) {
      hydratedLanguageForUserIdRef.current = null;
      return;
    }

    if (hydratedLanguageForUserIdRef.current === user.id) {
      return;
    }

    const preferredLanguage = pendingClientLanguages.get(user.id)?.language
      ?? getPreferredLanguageFromNotificationPrefs((user as any)?.notificationPrefs);
    if (preferredLanguage && preferredLanguage !== language) {
      setLanguage(preferredLanguage);
    }

    hydratedLanguageForUserIdRef.current = user.id;
  }, [language, setLanguage, user]);

  useEffect(() => {
    if (!user?.id) return;

    track({
      eventType: "page_view",
      entityType: "route",
      metadata: { path: location },
    });
  }, [location, track, user?.id]);

  useEffect(() => {
    if (!user) return;

    const touchInteraction = () => {
      const now = Date.now();
      if (now - lastInteractionAtRef.current < 60_000) return;
      lastInteractionAtRef.current = now;
      touchInteractionMutation.mutate();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        touchInteraction();
      }
    };

    touchInteraction();

    window.addEventListener("pointerdown", touchInteraction, { passive: true });
    window.addEventListener("keydown", touchInteraction);
    window.addEventListener("touchstart", touchInteraction, { passive: true });
    window.addEventListener("focus", touchInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", touchInteraction);
      window.removeEventListener("keydown", touchInteraction);
      window.removeEventListener("touchstart", touchInteraction);
      window.removeEventListener("focus", touchInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [touchInteractionMutation, user]);

  const handleLogout = async () => {
    try { window.localStorage.removeItem("xflex_last_email"); } catch {}
    await logout();
    window.location.href = "/";
  };

  const toggleLanguagePreference = () => {
    const nextLanguage = language === "ar" ? "en" : "ar";

    if (user) {
      // A newly mounted layout hydrates language from auth.me. Keep that cache
      // in sync immediately so navigation cannot restore the previous language.
      pendingClientLanguages.set(user.id, { language: nextLanguage });
      cacheLanguage(user.id, nextLanguage);
      updateNotificationPrefsMutation.mutate({ language: nextLanguage });
    }
    setLanguage(nextLanguage);
  };

  const navItems = [
    {
      href: "/courses",
      label: t("dashboard.nav.dashboard"),
      icon: <LayoutDashboard className="h-4 w-4" />,
      match: "/courses",
    },
    ...(showLiveExpertInbox ? [{
      href: "/admin/live-expert",
      label: language === "ar" ? "رسائل خبير لايف" : "Live Expert Inbox",
      icon: <MessageSquare className="h-4 w-4" />,
      match: "/admin/live-expert",
    }] : []),
    {
      href: "/lexai",
      label: "LexAI",
      icon: <Sparkles className="h-4 w-4" />,
      match: "/lexai",
    },
    {
      href: "/recommendations",
      label: t("dashboard.nav.rec"),
      icon: <MessageSquare className="h-4 w-4" />,
      match: "/recommendations",
    },
    {
      href: "/documents",
      label: language === "ar" ? "ملفات الدورة" : "Course Documents",
      icon: <FileText className="h-4 w-4" />,
      match: "/documents",
    },
    {
      href: '/guides',
      label: language === 'ar' ? 'دليل الاستخدام' : 'How-to guides',
      icon: <BookOpen className="h-4 w-4" />,
      match: '/guides',
    },
    {
      href: "/support",
      label: t("dashboard.nav.support"),
      icon: <Headphones className="h-4 w-4" />,
      match: "/support",
    },
    ...(showCommunityNav ? [{
      href: "/community",
      label: t("dashboard.nav.community"),
      icon: <MessageSquare className="h-4 w-4" />,
      match: "/community",
    }] : []),
    ...(showJobEligibilityNav ? [{
      href: "/job-opportunities",
      label: t("dashboard.nav.jobOpportunities"),
      icon: <Briefcase className="h-4 w-4" />,
      match: "/job-opportunities",
    }] : []),
    {
      href: "/quiz",
      label: t("dashboard.nav.quizzes"),
      icon: <ClipboardCheck className="h-4 w-4" />,
      match: "/quiz",
    },
    ...(showStudentSurveysNav ? [{
      href: "/surveys",
      label: t("dashboard.nav.surveys"),
      icon: <ClipboardCheck className="h-4 w-4" />,
      match: "/surveys",
      badge: surveyAvailability?.outstandingCount ?? 0,
    }] : []),
    {
      href: "/my-packages",
      label: language === "ar" ? "باقتي" : "My Package",
      icon: <Package className="h-4 w-4" />,
      match: "/my-packages",
    },
    ...(livePackageAccess?.hasAccess ? [{
      href: "/live-package",
      label: language === "ar" ? "بكج لايف" : "Live Package",
      icon: <Radio className="h-4 w-4" />,
      match: "/live-package",
    }] : []),
    {
      href: "/activate-key",
      label: language === "ar" ? "تفعيل / تجديد مفتاح" : "Activate / Renew Key",
      icon: <Key className="h-4 w-4" />,
      match: "/activate-key",
    },
    {
      href: "/broker-onboarding",
      label: language === "ar" ? "الوسطاء" : "Brokers",
      icon: <Building2 className="h-4 w-4" />,
      match: "/broker",
    },
    {
      href: "/notifications",
      label: language === "ar" ? "الإشعارات" : "Notifications",
      icon: <Bell className="h-4 w-4" />,
      match: "/notifications",
      badge: unreadNotifCount,
    },
    {
      href: "/my-points",
      label: language === "ar" ? "النقاط" : "Points",
      icon: <Award className="h-4 w-4" />,
      match: "/my-points",
    },
    {
      href: "/calculators",
      label: language === "ar" ? "الحاسبات" : "Calculators",
      icon: <Calculator className="h-4 w-4" />,
      match: "/calculators",
    },
  ];

  return (
    <div className="min-h-screen flex min-w-0 flex-col">
      <ClientNavigation items={navItems} language={language} user={user} staffWorkspacePath={staffWorkspacePath} onLanguage={toggleLanguagePreference} onLogout={() => setShowLogoutDialog(true)} subHeader={subHeader} />
      <main className="nv2-client-main flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
        {user && <InterfaceAnnouncement key={user.id} user={user} audience={adminCheck?.isAdmin ? "admin" : adminCheck?.isStaff ? "staff" : "student"} />}
        {children}
      </main>
      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? "تأكيد تسجيل الخروج" : "Confirm Logout"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? "هل أنت متأكد من أنك تريد تسجيل الخروج؟" : "Are you sure you want to log out?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isRTL ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              {isRTL ? "تسجيل الخروج" : "Log Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
