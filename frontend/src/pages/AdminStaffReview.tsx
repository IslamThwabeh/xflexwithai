import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Eye,
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  GraduationCap,
  Megaphone,
  BarChart3,
  Star,
  Briefcase,
  Headphones,
  Shield,
  Key,
  Package,
  Tag,
  Building2,
  FileCheck,
  BookOpen,
  ClipboardCheck,
  FileText,
  CalendarDays,
  MessageSquareQuote,
  DollarSign,
  Clock,
  Activity,
  Bell,
  Award,
  UserCheck,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { ROLE_PAGE_ACCESS, ALL_STAFF_ROLES } from "@shared/const";

// ── Role labels & colors (same as AdminRoles) ─────────────────────────
const ROLE_LABELS: Record<string, { en: string; ar: string; color: string; group: string }> = {
  analyst:              { en: "Analyst",              ar: "محلل",            color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",   group: "core" },
  support:              { en: "Support",              ar: "دعم فني",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", group: "core" },
  key_manager:          { en: "Key Manager",          ar: "مدير المفاتيح",   color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",   group: "core" },
  view_progress:        { en: "View Progress",        ar: "عرض التقدم",      color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",   group: "perm" },
  view_recommendations: { en: "View Recommendations", ar: "عرض التوصيات",    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",     group: "perm" },
  view_subscriptions:   { en: "View Subscriptions",   ar: "عرض الاشتراكات",  color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",     group: "perm" },
  view_quizzes:         { en: "View Quizzes",         ar: "عرض الاختبارات",  color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", group: "perm" },
  client_lookup:        { en: "Client Lookup",        ar: "بحث العملاء",     color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", group: "perm" },
};

// ── Full sidebar definition (mirrors DashboardLayout) ─────────────────
type SidebarItem = { icon: any; labelEn: string; labelAr: string; path: string };
type SidebarSection = { icon: any; labelEn: string; labelAr: string; items: SidebarItem[] };

const FULL_SIDEBAR: SidebarSection[] = [
  {
    icon: LayoutDashboard, labelEn: "Overview", labelAr: "نظرة عامة",
    items: [
      { icon: LayoutDashboard, labelEn: "Dashboard", labelAr: "لوحة التحكم", path: "/admin/dashboard" },
    ],
  },
  {
    icon: ShoppingCart, labelEn: "Sales", labelAr: "المبيعات",
    items: [
      { icon: ShoppingCart, labelEn: "Orders", labelAr: "الطلبات", path: "/admin/orders" },
      { icon: Key, labelEn: "Activation Keys", labelAr: "مفاتيح التفعيل", path: "/admin/package-keys" },
      { icon: Package, labelEn: "Packages", labelAr: "الباقات", path: "/admin/packages" },
      { icon: Tag, labelEn: "Coupons", labelAr: "الكوبونات", path: "/admin/coupons" },
      { icon: Building2, labelEn: "Brokers", labelAr: "الوسطاء", path: "/admin/brokers" },
      { icon: FileCheck, labelEn: "Offer Agreements", labelAr: "اتفاقيات العروض", path: "/admin/offer-agreements" },
    ],
  },
  {
    icon: TrendingUp, labelEn: "Recommendations", labelAr: "قناة التوصيات",
    items: [
      { icon: TrendingUp, labelEn: "Recommendations", labelAr: "التوصيات", path: "/admin/recommendations" },
    ],
  },
  {
    icon: GraduationCap, labelEn: "Learning", labelAr: "التعلّم",
    items: [
      { icon: BookOpen, labelEn: "Courses", labelAr: "الدورات", path: "/admin/courses" },
      { icon: ClipboardCheck, labelEn: "Quizzes", labelAr: "الاختبارات", path: "/admin/quizzes" },
    ],
  },
  {
    icon: Megaphone, labelEn: "Content", labelAr: "المحتوى",
    items: [
      { icon: FileText, labelEn: "Articles", labelAr: "المقالات", path: "/admin/articles" },
      { icon: CalendarDays, labelEn: "Events", labelAr: "الفعاليات", path: "/admin/events" },
      { icon: MessageSquareQuote, labelEn: "Testimonials", labelAr: "الشهادات", path: "/admin/testimonials" },
    ],
  },
  {
    icon: Users, labelEn: "Students", labelAr: "الطلاب",
    items: [
      { icon: Users, labelEn: "Students", labelAr: "الطلاب", path: "/admin/students" },
    ],
  },
  {
    icon: ShieldCheck, labelEn: "Team", labelAr: "الفريق",
    items: [
      { icon: Headphones, labelEn: "Support Chat", labelAr: "الدعم الفني", path: "/admin/support" },
      { icon: Shield, labelEn: "Roles", labelAr: "الأدوار", path: "/admin/roles" },
    ],
  },
  {
    icon: BarChart3, labelEn: "Reports", labelAr: "التقارير",
    items: [
      { icon: DollarSign, labelEn: "Revenue", labelAr: "الإيرادات", path: "/admin/reports/revenue" },
      { icon: Clock, labelEn: "Expiry", labelAr: "انتهاء الصلاحية", path: "/admin/reports/expiry" },
      { icon: Activity, labelEn: "Engagement", labelAr: "التفاعل", path: "/admin/engagement" },
    ],
  },
  {
    icon: Star, labelEn: "Moderation", labelAr: "الإشراف",
    items: [
      { icon: Star, labelEn: "Reviews", labelAr: "التقييمات", path: "/admin/reviews" },
      { icon: Bell, labelEn: "Notifications", labelAr: "الإشعارات", path: "/admin/notifications" },
      { icon: Award, labelEn: "Loyalty Points", labelAr: "نقاط الولاء", path: "/admin/points" },
    ],
  },
  {
    icon: Briefcase, labelEn: "Careers", labelAr: "الوظائف",
    items: [
      { icon: Briefcase, labelEn: "Job Applications", labelAr: "طلبات التوظيف", path: "/admin/jobs" },
    ],
  },
];

// ── Backend endpoint access definition ────────────────────────────────
type EndpointDef = { endpoint: string; descEn: string; descAr: string; requiredRoles: string[] | "admin-only" };

const SUPPORT_STAFF_ROLES: string[] = ["support", "key_manager", "client_lookup", "view_progress", "view_recommendations", "view_subscriptions", "view_quizzes"];

const ENDPOINT_ACCESS: EndpointDef[] = [
  { endpoint: "supportChat.listAll",     descEn: "List support conversations",   descAr: "عرض محادثات الدعم",          requiredRoles: [...SUPPORT_STAFF_ROLES] },
  { endpoint: "supportChat.getMessages", descEn: "Read support messages",        descAr: "قراءة رسائل الدعم",          requiredRoles: [...SUPPORT_STAFF_ROLES] },
  { endpoint: "supportChat.reply",       descEn: "Reply to support messages",    descAr: "الرد على رسائل الدعم",       requiredRoles: [...SUPPORT_STAFF_ROLES] },
  { endpoint: "supportChat.suggestReply", descEn: "AI suggest reply",            descAr: "اقتراح رد بالذكاء الاصطناعي", requiredRoles: [...SUPPORT_STAFF_ROLES] },
  { endpoint: "supportChat.clearEscalation", descEn: "Clear escalation flag",    descAr: "إلغاء علامة التصعيد",        requiredRoles: [...SUPPORT_STAFF_ROLES] },
  { endpoint: "recommendations.postMessage", descEn: "Post recommendations",     descAr: "نشر التوصيات",               requiredRoles: ["analyst"] },
  { endpoint: "enrollments.skipCourse",  descEn: "Skip course for student",      descAr: "تخطي الدورة للطالب",         requiredRoles: ["key_manager", "support"] },
  { endpoint: "enrollments.rollbackSkip", descEn: "Rollback course skip",        descAr: "التراجع عن تخطي الدورة",     requiredRoles: ["key_manager", "support"] },
  { endpoint: "supportDashboard.searchClients", descEn: "Search clients",        descAr: "البحث عن العملاء",           requiredRoles: ["client_lookup", "support"] },
  { endpoint: "supportDashboard.clientProgress", descEn: "View student progress", descAr: "عرض تقدم الطالب",           requiredRoles: ["view_progress"] },
  { endpoint: "supportDashboard.clientSubscriptions", descEn: "View subscriptions", descAr: "عرض الاشتراكات",         requiredRoles: ["view_subscriptions"] },
  { endpoint: "supportDashboard.clientQuizzes", descEn: "View quiz results",     descAr: "عرض نتائج الاختبارات",       requiredRoles: ["view_quizzes"] },
  { endpoint: "dashboard.stats",          descEn: "Dashboard statistics",        descAr: "إحصائيات لوحة التحكم",       requiredRoles: "admin-only" },
  { endpoint: "courses.*",                descEn: "Manage courses",              descAr: "إدارة الدورات",              requiredRoles: "admin-only" },
  { endpoint: "episodes.*",               descEn: "Manage episodes",             descAr: "إدارة الحلقات",              requiredRoles: "admin-only" },
  { endpoint: "roles.*",                  descEn: "Manage roles",                descAr: "إدارة الأدوار",              requiredRoles: "admin-only" },
  { endpoint: "users.*",                  descEn: "Manage users",                descAr: "إدارة المستخدمين",           requiredRoles: "admin-only" },
];

// ── Helpers ───────────────────────────────────────────────────────────
function getAccessiblePaths(roles: string[]): Set<string> {
  const paths = new Set<string>();
  for (const role of roles) {
    for (const p of ROLE_PAGE_ACCESS[role] ?? []) {
      paths.add(p);
    }
  }
  return paths;
}

function hasEndpointAccess(staffRoles: string[], ep: EndpointDef): boolean {
  if (ep.requiredRoles === "admin-only") return false;
  return ep.requiredRoles.some(r => staffRoles.includes(r));
}

// ══════════════════════════════════════════════════════════════════════
// AdminStaffReview Page
// ══════════════════════════════════════════════════════════════════════
export default function AdminStaffReview() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: staffMembers, isLoading: staffLoading } = trpc.roles.listStaff.useQuery();

  const { data: preview, isLoading: previewLoading } = trpc.roles.getStaffAccessPreview.useQuery(
    { userId: selectedStaffId! },
    { enabled: !!selectedStaffId },
  );

  const filteredStaff = useMemo(() => {
    if (!staffMembers) return [];
    if (!searchQuery.trim()) return staffMembers;
    const q = searchQuery.toLowerCase();
    return staffMembers.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  }, [staffMembers, searchQuery]);

  const accessiblePaths = useMemo(() => {
    if (!preview?.roles) return new Set<string>();
    return getAccessiblePaths(preview.roles);
  }, [preview?.roles]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-6 h-6 text-emerald-500" />
              {isRtl ? "مراجعة صلاحيات الموظفين" : "Staff Access Review"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isRtl
                ? "راجع ما يراه كل موظف في لوحة التحكم وتحقق من صحة الصلاحيات"
                : "Review what each employee sees in the admin panel and verify permissions are correct"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Staff List (Left Column) ──────────────────────── */}
          <div className="lg:col-span-4">
            <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  {isRtl ? "الموظفون" : "Staff Members"}
                  {staffMembers && (
                    <Badge variant="secondary" className="text-xs ms-auto">{staffMembers.length}</Badge>
                  )}
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={isRtl ? "بحث عن موظف..." : "Search staff..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-2 max-h-[500px] overflow-y-auto">
                {staffLoading ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    {isRtl ? "جاري التحميل..." : "Loading..."}
                  </div>
                ) : !filteredStaff?.length ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    {isRtl ? "لا يوجد موظفون" : "No staff members found"}
                  </div>
                ) : (
                  filteredStaff.map((staff: any) => {
                    const isSelected = selectedStaffId === staff.id;
                    return (
                      <button
                        key={staff.id}
                        onClick={() => setSelectedStaffId(staff.id)}
                        className={`w-full text-start p-3 rounded-xl mb-1 transition-all ${
                          isSelected
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30"
                            : "hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isSelected
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                          }`}>
                            {staff.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-white"}`}>
                              {staff.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{staff.email}</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-emerald-500 rotate-90" : "text-gray-300"}`} />
                        </div>
                        {staff.roles?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 ms-12">
                            {staff.roles.map((role: string) => (
                              <span key={role} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[role]?.color || "bg-gray-100 text-gray-600"}`}>
                                {isRtl ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en || role}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Preview Panel (Right Column) ──────────────────── */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedStaffId ? (
              <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                    <UserCheck className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {isRtl ? "اختر موظفاً لمراجعة صلاحياته" : "Select a staff member to review"}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">
                    {isRtl
                      ? "اختر موظفاً من القائمة لمشاهدة ما يظهر له في لوحة التحكم والصلاحيات المتاحة"
                      : "Pick a staff member from the list to see their dashboard view and available permissions"}
                  </p>
                </CardContent>
              </Card>
            ) : previewLoading ? (
              <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                <CardContent className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </CardContent>
              </Card>
            ) : preview ? (
              <>
                {/* ── Staff Info Card ──────────────────────────── */}
                <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                        {preview.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{preview.name}</h2>
                        <p className="text-sm text-gray-500">{preview.email}</p>
                        {preview.phone && <p className="text-xs text-gray-400 mt-0.5">{preview.phone}</p>}
                      </div>
                      <div className="text-end">
                        <Badge className={preview.isStaff ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700"}>
                          {preview.isStaff ? (isRtl ? "موظف نشط" : "Active Staff") : (isRtl ? "غير نشط" : "Inactive")}
                        </Badge>
                        {preview.lastSignIn && (
                          <p className="text-xs text-gray-400 mt-1">
                            {isRtl ? "آخر دخول: " : "Last login: "}
                            {new Date(preview.lastSignIn).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Roles */}
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {isRtl ? "الأدوار المُسندة" : "Assigned Roles"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {preview.roles.length === 0 ? (
                          <span className="text-sm text-gray-400 italic">{isRtl ? "لا توجد أدوار" : "No roles assigned"}</span>
                        ) : (
                          preview.roles.map((role: string) => (
                            <Badge key={role} className={`${ROLE_LABELS[role]?.color || "bg-gray-100 text-gray-600"} text-xs`}>
                              {isRtl ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en || role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Sidebar Preview ─────────────────────────── */}
                <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                      {isRtl ? "معاينة القائمة الجانبية" : "Sidebar Preview"}
                      <span className="text-xs text-gray-400 font-normal ms-2">
                        {isRtl ? "ما يراه هذا الموظف" : "What this employee sees"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-900 rounded-xl p-4 space-y-1 max-w-sm">
                      {FULL_SIDEBAR.map((section, si) => {
                        const visibleItems = section.items.filter(item => accessiblePaths.has(item.path));
                        const hasAnyVisible = visibleItems.length > 0;
                        const SectionIcon = section.icon;
                        return (
                          <div key={si}>
                            {/* Section header */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                              hasAnyVisible ? "text-gray-300" : "text-gray-600 line-through"
                            }`}>
                              <div className={`w-6 h-6 rounded flex items-center justify-center ${hasAnyVisible ? "bg-white/5" : "bg-white/[0.02]"}`}>
                                <SectionIcon className={`w-3.5 h-3.5 ${hasAnyVisible ? "text-gray-400" : "text-gray-700"}`} />
                              </div>
                              <span>{isRtl ? section.labelAr : section.labelEn}</span>
                              {hasAnyVisible ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ms-auto" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500/50 ms-auto" />
                              )}
                            </div>

                            {/* Items */}
                            {section.items.map((item, ii) => {
                              const allowed = accessiblePaths.has(item.path);
                              return (
                                <div
                                  key={ii}
                                  className={`flex items-center gap-2 ps-10 pe-3 py-1.5 text-[12px] rounded ${
                                    allowed
                                      ? "text-gray-300 bg-emerald-500/5 border-s-2 border-emerald-400"
                                      : "text-gray-600 opacity-50"
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${allowed ? "bg-emerald-400" : "bg-gray-700"}`} />
                                  <span className={allowed ? "" : "line-through"}>{isRtl ? item.labelAr : item.labelEn}</span>
                                  {allowed && <CheckCircle2 className="w-3 h-3 text-emerald-400 ms-auto" />}
                                  {!allowed && <XCircle className="w-3 h-3 text-red-500/40 ms-auto" />}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    {/* Summary */}
                    <div className="mt-3 flex gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {accessiblePaths.size} {isRtl ? "صفحات متاحة" : "pages accessible"}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        {FULL_SIDEBAR.flatMap(s => s.items).length - accessiblePaths.size} {isRtl ? "صفحات محجوبة" : "pages blocked"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Endpoint Access Table ────────────────────── */}
                <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      {isRtl ? "صلاحيات الموظف" : "Staff Permissions"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-white/10">
                            <th className="text-start py-2 text-xs font-medium text-gray-500 uppercase">
                              {isRtl ? "الوصف" : "Permission"}
                            </th>
                            <th className="text-center py-2 text-xs font-medium text-gray-500 uppercase">
                              {isRtl ? "الحالة" : "Status"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ENDPOINT_ACCESS.map((ep, i) => {
                            const allowed = ep.requiredRoles !== "admin-only" && hasEndpointAccess(preview.roles, ep);
                            const isAdminOnly = ep.requiredRoles === "admin-only";
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-white/5 last:border-none">
                                <td className="py-2.5 text-gray-700 dark:text-gray-300 text-sm">{isRtl ? ep.descAr : ep.descEn}</td>
                                <td className="py-2.5 text-center">
                                  {isAdminOnly ? (
                                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-300 dark:border-white/10">
                                      {isRtl ? "مدير فقط" : "Admin only"}
                                    </Badge>
                                  ) : allowed ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                                      <CheckCircle2 className="w-3 h-3 me-1" />
                                      {isRtl ? "متاح" : "Allowed"}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs">
                                      <XCircle className="w-3 h-3 me-1" />
                                      {isRtl ? "محجوب" : "Blocked"}
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Role-to-Page Matrix ──────────────────────── */}
                <Card className="border-gray-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      {isRtl ? "مصفوفة الأدوار والصفحات" : "Role-to-Page Access Matrix"}
                      <span className="text-xs text-gray-400 font-normal ms-2">
                        {isRtl ? "جميع الأدوار" : "All roles"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-white/10">
                            <th className="text-start py-2 font-medium text-gray-500 min-w-[120px]">
                              {isRtl ? "الدور" : "Role"}
                            </th>
                            {FULL_SIDEBAR.flatMap(s => s.items).map((item, i) => (
                              <th key={i} className="text-center py-2 font-medium text-gray-500 px-1 min-w-[28px]" title={isRtl ? item.labelAr : item.labelEn}>
                                <item.icon className="w-3.5 h-3.5 mx-auto text-gray-400" />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ALL_STAFF_ROLES.map((role) => {
                            const rolePaths = new Set(ROLE_PAGE_ACCESS[role] ?? []);
                            const isAssigned = preview.roles.includes(role);
                            return (
                              <tr key={role} className={`border-b border-gray-100 dark:border-white/5 last:border-none ${isAssigned ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}>
                                <td className="py-2 pe-2">
                                  <div className="flex items-center gap-1.5">
                                    {isAssigned && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                                    <span className={`${ROLE_LABELS[role]?.color || ""} px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap`}>
                                      {isRtl ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en || role}
                                    </span>
                                  </div>
                                </td>
                                {FULL_SIDEBAR.flatMap(s => s.items).map((item, i) => {
                                  const hasAccess = rolePaths.has(item.path);
                                  return (
                                    <td key={i} className="text-center py-2">
                                      {hasAccess ? (
                                        <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                      ) : (
                                        <div className="w-5 h-5 rounded flex items-center justify-center mx-auto">
                                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Column legend */}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-400">
                      {FULL_SIDEBAR.flatMap(s => s.items).map((item, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <item.icon className="w-3 h-3" />
                          {isRtl ? item.labelAr : item.labelEn}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
