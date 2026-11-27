import {
  LayoutDashboard,
  LogOut,
  Users,
  BookOpen,
  Key,
  MessageSquare,
  Shield,
  Headphones,
  Globe,
  Package,
  Radio,
  ShoppingCart,
  CalendarDays,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Tag,
  MessageSquareQuote,
  Clock,
  DollarSign,
  Briefcase,
  Search,
  Star,
  Bell,
  Award,
  Activity,
  Bug,
  Building2,
  FileCheck,
  Moon,
  Sun,
  ChevronDown,
  BarChart3,
  Megaphone,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Settings2,
  Mail,
  Boxes,
  Sparkles,
  X,
  User,
} from "lucide-react";

// Menu sections use i18n keys – resolved at render time
export type LocalizedMenuLabel = { en: string; ar: string };
export type MenuItem = {
  icon: any;
  labelKey: string;
  label?: LocalizedMenuLabel;
  path: string;
  descKey?: string;
};
export type MenuSection = {
  icon: any;
  labelKey: string;
  label?: LocalizedMenuLabel;
  items: MenuItem[];
};

export const menuSectionsDef: MenuSection[] = [
  {
    icon: LayoutDashboard,
    labelKey: "admin.sidebar.overview",
    items: [
      {
        icon: LayoutDashboard,
        labelKey: "admin.sidebar.dashboard",
        path: "/admin/dashboard",
      },
      {
        icon: Sparkles,
        labelKey: "admin.sidebar.settings",
        label: { en: "Feature Center", ar: "مركز الميزات" },
        path: "/admin/features",
      },
    ],
  },
  {
    icon: Boxes,
    labelKey: "admin.sidebar.overview",
    label: { en: "Feature Management", ar: "إدارة الميزات" },
    items: [
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.staffPerformance",
        path: "/admin/staff-performance",
      },
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.studentSurveys",
        path: "/admin/student-surveys",
      },
      {
        icon: Award,
        labelKey: "admin.sidebar.loyaltyPoints",
        label: { en: "Points & Rewards", ar: "النقاط والمكافآت" },
        path: "/admin/points",
      },
      {
        icon: MessageSquare,
        labelKey: "admin.sidebar.community",
        path: "/admin/community",
      },
      {
        icon: ShieldCheck,
        labelKey: "admin.sidebar.jobEligibility",
        path: "/admin/job-eligibility",
      },
    ],
  },
  {
    icon: ShoppingCart,
    labelKey: "admin.sidebar.sales",
    items: [
      {
        icon: ShoppingCart,
        labelKey: "admin.sidebar.orders",
        path: "/admin/orders",
      },
      {
        icon: DollarSign,
        labelKey: "admin.sidebar.expenses",
        path: "/admin/finance/expenses",
      },
      {
        icon: BarChart3,
        labelKey: "admin.sidebar.financialDashboard",
        path: "/admin/finance",
      },
      {
        icon: ShieldCheck,
        labelKey: "admin.sidebar.financialControls",
        path: "/admin/finance/controls",
      },
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.financialReconciliation",
        path: "/admin/finance/reconciliation",
      },
      {
        icon: ClipboardList,
        labelKey: "admin.sidebar.legacyMigrations",
        label: { en: "Legacy migrations", ar: "ترحيل العملاء القدامى" },
        path: "/admin/finance/legacy-migrations",
      },
      {
        icon: Key,
        labelKey: "admin.sidebar.activationKeys",
        path: "/admin/package-keys",
      },
      {
        icon: Package,
        labelKey: "admin.sidebar.packages",
        path: "/admin/packages",
      },
      {
        icon: Radio,
        labelKey: "admin.sidebar.livePackage",
        label: { en: "Live Package", ar: "بكج لايف" },
        path: "/admin/live-package",
      },
      {
        icon: MessageSquare,
        labelKey: "admin.sidebar.liveExpert",
        label: { en: "Live Expert Inbox", ar: "رسائل خبير لايف" },
        path: "/admin/live-expert",
      },
      {
        icon: TrendingUp,
        labelKey: "admin.sidebar.tradeCopier",
        label: { en: "Trade Copier", ar: "الناسخ" },
        path: "/admin/copier",
      },
      {
        icon: ClipboardList,
        labelKey: "admin.sidebar.livePackageReview",
        path: "/admin/live-package-review",
      },
      { icon: Tag, labelKey: "admin.sidebar.coupons", path: "/admin/coupons" },
      {
        icon: Building2,
        labelKey: "admin.sidebar.brokers",
        path: "/admin/brokers",
      },
      {
        icon: FileCheck,
        labelKey: "admin.sidebar.termsAcceptance",
        path: "/admin/terms-acceptance",
      },
    ],
  },
  {
    icon: TrendingUp,
    labelKey: "admin.sidebar.recChannel",
    items: [
      {
        icon: TrendingUp,
        labelKey: "admin.sidebar.recommendations",
        path: "/admin/recommendations",
      },
    ],
  },
  {
    icon: MessageSquare,
    labelKey: "admin.sidebar.lexai",
    items: [
      {
        icon: MessageSquare,
        labelKey: "admin.sidebar.lexai",
        path: "/admin/lexai",
      },
    ],
  },
  {
    icon: GraduationCap,
    labelKey: "admin.sidebar.learning",
    items: [
      {
        icon: BookOpen,
        labelKey: "admin.sidebar.courses",
        path: "/admin/courses",
      },
      {
        icon: GraduationCap,
        labelKey: "admin.sidebar.planProgress",
        path: "/admin/plan-progress",
      },
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.quizzes",
        path: "/admin/quizzes",
      },
    ],
  },
  {
    icon: Megaphone,
    labelKey: "admin.sidebar.content",
    items: [
      {
        icon: FileText,
        labelKey: "admin.sidebar.articles",
        path: "/admin/articles",
      },
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.seoOwnerIntake",
        path: "/admin/seo-owner-intake",
      },
      {
        icon: CalendarDays,
        labelKey: "admin.sidebar.events",
        path: "/admin/events",
      },
      {
        icon: MessageSquareQuote,
        labelKey: "admin.sidebar.testimonials",
        path: "/admin/testimonials",
      },
    ],
  },
  {
    icon: Users,
    labelKey: "admin.sidebar.students",
    items: [
      {
        icon: Users,
        labelKey: "admin.sidebar.students",
        path: "/admin/students",
      },
      {
        icon: Users,
        labelKey: "admin.sidebar.subscribers",
        path: "/admin/reports/subscribers",
      },
    ],
  },
  {
    icon: ShieldCheck,
    labelKey: "admin.sidebar.team",
    items: [
      {
        icon: Headphones,
        labelKey: "admin.sidebar.supportChat",
        path: "/admin/support",
      },
      {
        icon: Bug,
        labelKey: "admin.sidebar.bugReports",
        path: "/admin/bug-reports",
      },
      { icon: Shield, labelKey: "admin.sidebar.roles", path: "/admin/roles" },
      {
        icon: Search,
        labelKey: "admin.sidebar.staffReview",
        path: "/admin/staff-review",
      },
      {
        icon: ClipboardCheck,
        labelKey: "admin.sidebar.myPerformance",
        path: "/admin/my-performance",
      },
    ],
  },
  {
    icon: BarChart3,
    labelKey: "admin.sidebar.reports",
    items: [
      {
        icon: Key,
        labelKey: "admin.sidebar.revenue",
        path: "/admin/reports/activations",
      },
      {
        icon: Clock,
        labelKey: "admin.sidebar.expiry",
        path: "/admin/reports/expiry",
      },
      {
        icon: Building2,
        labelKey: "admin.sidebar.brokerReport",
        path: "/admin/reports/brokers",
      },
      {
        icon: Activity,
        labelKey: "admin.sidebar.engagement",
        path: "/admin/engagement",
      },
      {
        icon: ShieldCheck,
        labelKey: "admin.sidebar.monitoring",
        path: "/admin/monitoring",
      },
    ],
  },
  {
    icon: Star,
    labelKey: "admin.sidebar.moderation",
    items: [
      { icon: Star, labelKey: "admin.sidebar.reviews", path: "/admin/reviews" },
    ],
  },
  {
    icon: Settings2,
    labelKey: "admin.sidebar.settings",
    label: { en: "Communications & Settings", ar: "التواصل والإعدادات" },
    items: [
      {
        icon: Bell,
        labelKey: "admin.sidebar.notifications",
        path: "/admin/notifications",
      },
      {
        icon: Mail,
        labelKey: "admin.sidebar.emailLogs",
        path: "/admin/email-logs",
      },
      {
        icon: Settings2,
        labelKey: "admin.sidebar.settings",
        path: "/admin/settings",
      },
    ],
  },
  {
    icon: Briefcase,
    labelKey: "admin.sidebar.careers",
    items: [
      {
        icon: Briefcase,
        labelKey: "admin.sidebar.jobsApplications",
        path: "/admin/jobs",
      },
    ],
  },
  // Hidden sections — backend kept, UI disabled
  // {
  //   labelKey: "admin.sidebar.lexai",
  //   items: [
  //     { icon: MessageSquare, labelKey: "admin.sidebar.conversations", path: "/admin/lexai/conversations" },
  //     { icon: Users, labelKey: "admin.sidebar.subscriptions", path: "/admin/lexai/subscriptions" },
  //   ]
  // },
];

export const employeeTrainingSection: MenuSection = {
  icon: GraduationCap,
  labelKey: "admin.sidebar.learning",
  label: { en: "Employee Training", ar: "تدريب الموظفين" },
  items: [
    {
      icon: BookOpen,
      labelKey: "admin.sidebar.courses",
      label: { en: "My Course", ar: "دورتي التدريبية" },
      path: "/courses",
    },
  ],
};
