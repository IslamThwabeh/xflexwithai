import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useParams } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { lazy, Suspense, type ReactNode } from "react";
import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import WhatsAppFloat from "./components/WhatsAppFloat";
import SessionGuard from "./components/SessionGuard";
import LocalizedPublicPage from "./components/LocalizedPublicPage";
import AnalyticsTracker from "./components/AnalyticsTracker";
import type { SeoLanguage, SeoRouteKey } from "@shared/seo";

const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));

// Lazy-loaded admin pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminEpisodes = lazy(() => import("./pages/AdminEpisodes"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminLexai = lazy(() => import("./pages/AdminLexai"));
const AdminLexaiSubscriptions = lazy(() => import("./pages/AdminLexaiSubscriptions"));
const AdminLexaiConversations = lazy(() => import("./pages/AdminLexaiConversations"));
const AdminRecommendations = lazy(() => import("./pages/AdminRecommendations"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const AdminStaffReview = lazy(() => import("./pages/AdminStaffReview"));
const AdminPackages = lazy(() => import("./pages/AdminPackages"));
const AdminEvents = lazy(() => import("./pages/AdminEvents"));
const AdminArticles = lazy(() => import("./pages/AdminArticles"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminQuizzes = lazy(() => import("./pages/AdminQuizzes"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminTestimonials = lazy(() => import("./pages/AdminTestimonials"));
const AdminBrokersHub = lazy(() => import("./pages/AdminBrokersHub"));
const AdminSubscribersReport = lazy(() => import("./pages/AdminSubscribersReport"));
const AdminRevenueReport = lazy(() => import("./pages/AdminRevenueReport"));
const AdminExpiryReport = lazy(() => import("./pages/AdminExpiryReport"));
const AdminPackageKeys = lazy(() => import("./pages/AdminPackageKeys"));

// Lazy-loaded user pages
const MyDashboard = lazy(() => import("./pages/MyDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const CourseWatch = lazy(() => import("./pages/CourseWatch"));
const ActivateKey = lazy(() => import("./pages/ActivateKey"));
const LexAI = lazy(() => import("./pages/LexAI"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const SupportChat = lazy(() => import("./pages/SupportChat"));
const QuizLevels = lazy(() => import("./pages/QuizLevels"));
const TakeQuiz = lazy(() => import("./pages/TakeQuiz"));
const QuizHistory = lazy(() => import("./pages/QuizHistory"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const MySubscriptions = lazy(() => import("./pages/MySubscriptions"));
const StudentPackages = lazy(() => import("./pages/StudentPackages"));
const StudentDocuments = lazy(() => import("./pages/StudentDocuments"));
const BrokerSelection = lazy(() => import("./pages/BrokerSelection"));
const BrokerOnboarding = lazy(() => import("./pages/BrokerOnboarding"));
const Upgrade = lazy(() => import("./pages/Upgrade"));

// Lazy-loaded public pages
const PackageDetails = lazy(() => import("./pages/PackageDetails"));
const About = lazy(() => import("./pages/About"));
const Events = lazy(() => import("./pages/Events"));
const Articles = lazy(() => import("./pages/Articles"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const FreeContent = lazy(() => import("./pages/FreeContent"));
const Gifts = lazy(() => import("./pages/Gifts"));
const Contact = lazy(() => import("./pages/Contact"));
const VipTradingBotPlanLanding = lazy(() => import("./pages/VipTradingBotPlanLanding"));
const VipTradingBotPlanEnglish = lazy(() => import("./pages/VipTradingBotPlanEnglish"));
const VipTradingBotPlanArabic = lazy(() => import("./pages/VipTradingBotPlanArabic"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Careers = lazy(() => import("./pages/Careers"));
const AdminJobs = lazy(() => import("./pages/AdminJobs"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminEmailLogs = lazy(() => import("./pages/AdminEmailLogs"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminPoints = lazy(() => import("./pages/AdminPoints"));
const AdminBugReports = lazy(() => import("./pages/AdminBugReports"));
const AdminEngagement = lazy(() => import("./pages/AdminEngagement"));
const AdminMonitoring = lazy(() => import("./pages/AdminMonitoring"));
const AdminOfferAgreements = lazy(() => import("./pages/AdminOfferAgreements"));
const AdminTermsAcceptance = lazy(() => import("./pages/AdminTermsAcceptance"));
const AdminPlanProgress = lazy(() => import("./pages/AdminPlanProgress"));
const AdminLegacyPlanProgress = lazy(() => import("./pages/AdminLegacyPlanProgress"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const LoyaltyPoints = lazy(() => import("./pages/LoyaltyPoints"));
const TradingCalculators = lazy(() => import("./pages/TradingCalculators"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const TrustCenter = lazy(() => import("./pages/TrustCenter"));

// Minimal fallback spinner
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Localized({
  language,
  seoKey,
  children,
}: {
  language: SeoLanguage;
  seoKey: SeoRouteKey;
  children: ReactNode;
}) {
  return (
    <LocalizedPublicPage language={language} seoKey={seoKey}>
      {children}
    </LocalizedPublicPage>
  );
}

function LegacyPublicRedirect() {
  const path = window.location.pathname === "/" ? "" : window.location.pathname;
  return <Redirect to={`/ar${path}${window.location.search}${window.location.hash}`} />;
}

function LocalizedPackage({ language }: { language: SeoLanguage }) {
  const { slug } = useParams<{ slug: string }>();
  const seoKey = slug === "comprehensive" ? "package-comprehensive" : "package-basic";
  return <Localized language={language} seoKey={seoKey}><PackageDetails /></Localized>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path={"/auth"} component={Auth} />
      <Route path={"/login"} component={Auth} />
      <Route path={"/register"} component={Auth} />
      <Route path={"/signup"} component={Auth} />
      <Route path={"/unsubscribe"} component={Unsubscribe} />
      <Route path={"/admin"} component={AdminLogin} />
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/dashboard"}>
        <Redirect to="/courses" />
      </Route>
      <Route path={"/courses"}>
        <ProtectedRoute>
          <MyDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/documents"}>
        <ProtectedRoute>
          <StudentDocuments />
        </ProtectedRoute>
      </Route>
      <Route path={"/profile"}>
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path={"/admin/dashboard"}>
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      </Route>
      <Route path={"/admin/courses"}>
        <AdminRoute>
          <AdminCourses />
        </AdminRoute>
      </Route>
      <Route path={"/admin/courses/:courseId/episodes"}>
        <AdminRoute>
          <AdminEpisodes />
        </AdminRoute>
      </Route>
      <Route path={"/admin/quizzes"}>
        <AdminRoute>
          <AdminQuizzes />
        </AdminRoute>
      </Route>
      <Route path={"/admin/students"}>
        <AdminRoute>
          <AdminStudents />
        </AdminRoute>
      </Route>
      <Route path={"/admin/users"}>
        <AdminRoute>
          <AdminStudents />
        </AdminRoute>
      </Route>
      {/* Old course keys route hidden — replaced by package keys */}
      <Route path={"/admin/package-keys"}>
        <AdminRoute>
          <AdminPackageKeys />
        </AdminRoute>
      </Route>
      <Route path={"/admin/lexai"}>
        <AdminRoute>
          <AdminLexai />
        </AdminRoute>
      </Route>
      <Route path={"/admin/lexai/subscriptions"}>
        <AdminRoute>
          <AdminLexaiSubscriptions />
        </AdminRoute>
      </Route>
      <Route path={"/admin/lexai/conversations"}>
        <AdminRoute>
          <AdminLexaiConversations />
        </AdminRoute>
      </Route>
      <Route path={"/admin/recommendations"}>
        <AdminRoute>
          <AdminRecommendations />
        </AdminRoute>
      </Route>
      <Route path={"/admin/support"}>
        <AdminRoute>
          <AdminSupport />
        </AdminRoute>
      </Route>
      <Route path={"/admin/roles"}>
        <AdminRoute>
          <AdminRoles />
        </AdminRoute>
      </Route>
      <Route path="/admin/staff-review">
        <AdminRoute>
          <AdminStaffReview />
        </AdminRoute>
      </Route>      <Route path={"/admin/packages"}>
        <AdminRoute>
          <AdminPackages />
        </AdminRoute>
      </Route>
      <Route path={"/admin/orders"}>
        <AdminRoute>
          <AdminOrders />
        </AdminRoute>
      </Route>
      <Route path={"/admin/events"}>
        <AdminRoute>
          <AdminEvents />
        </AdminRoute>
      </Route>
      <Route path={"/admin/articles"}>
        <AdminRoute>
          <AdminArticles />
        </AdminRoute>
      </Route>
      <Route path={"/admin/coupons"}>
        <AdminRoute>
          <AdminCoupons />
        </AdminRoute>
      </Route>
      <Route path={"/admin/testimonials"}>
        <AdminRoute>
          <AdminTestimonials />
        </AdminRoute>
      </Route>
      <Route path="/admin/brokers">
        <AdminRoute>
          <AdminBrokersHub />
        </AdminRoute>
      </Route>
      <Route path="/admin/broker-onboarding">
        <AdminRoute>
          <AdminBrokersHub />
        </AdminRoute>
      </Route>
      <Route path={"/admin/offer-agreements"}>
        <AdminRoute>
          <AdminOfferAgreements />
        </AdminRoute>
      </Route>
      <Route path={"/admin/terms-acceptance"}>
        <AdminRoute>
          <AdminTermsAcceptance />
        </AdminRoute>
      </Route>
      <Route path={"/admin/plan-progress"}>
        <AdminRoute>
          <AdminPlanProgress />
        </AdminRoute>
      </Route>
      <Route path={"/admin/plan-progress/legacy"}>
        <AdminRoute>
          <AdminLegacyPlanProgress />
        </AdminRoute>
      </Route>
      <Route path={"/admin/reports/subscribers"}>
        <AdminRoute>
          <AdminSubscribersReport />
        </AdminRoute>
      </Route>
      <Route path={"/admin/reports/revenue"}>
        <AdminRoute>
          <AdminRevenueReport />
        </AdminRoute>
      </Route>
      <Route path={"/admin/reports/expiry"}>
        <AdminRoute>
          <AdminExpiryReport />
        </AdminRoute>
      </Route>
      <Route path={"/activate-key"} component={ActivateKey} />
      <Route path={"/course/:id"} component={CourseWatch} />
      <Route path={"/lexai"}>
        <ProtectedRoute>
          <LexAI />
        </ProtectedRoute>
      </Route>
      <Route path={"/recommendations"}>
        <ProtectedRoute>
          <Recommendations />
        </ProtectedRoute>
      </Route>
      <Route path={"/support"}>
        <ProtectedRoute>
          <SupportChat />
        </ProtectedRoute>
      </Route>
      <Route path="/quiz">
        <ProtectedRoute>
          <QuizLevels />
        </ProtectedRoute>
      </Route>
      <Route path="/quiz/:level">
        <ProtectedRoute>
          <TakeQuiz />
        </ProtectedRoute>
      </Route>
      <Route path="/quiz/:level/history">
        <ProtectedRoute>
          <QuizHistory />
        </ProtectedRoute>
      </Route>
      <Route path="/ar/packages/:slug"><LocalizedPackage language="ar" /></Route>
      <Route path="/en/packages/:slug"><LocalizedPackage language="en" /></Route>
      <Route path="/packages/:slug"><LegacyPublicRedirect /></Route>
      <Route path="/checkout/:slug" component={Checkout} />
      <Route path="/ar/about"><Localized language="ar" seoKey="about"><About /></Localized></Route>
      <Route path="/en/about"><Localized language="en" seoKey="about"><About /></Localized></Route>
      <Route path="/ar/events"><Localized language="ar" seoKey="events"><Events /></Localized></Route>
      <Route path="/en/events"><Localized language="en" seoKey="events"><Events /></Localized></Route>
      <Route path="/ar/articles"><Localized language="ar" seoKey="articles"><Articles /></Localized></Route>
      <Route path="/en/articles"><Localized language="en" seoKey="articles"><Articles /></Localized></Route>
      <Route path="/ar/articles/:slug"><Localized language="ar" seoKey="articles"><ArticleDetail /></Localized></Route>
      <Route path="/en/articles/:slug"><Localized language="en" seoKey="articles"><ArticleDetail /></Localized></Route>
      <Route path="/ar/free-content"><Localized language="ar" seoKey="free-content"><FreeContent /></Localized></Route>
      <Route path="/en/free-content"><Localized language="en" seoKey="free-content"><FreeContent /></Localized></Route>
      <Route path="/ar/gifts"><Localized language="ar" seoKey="gifts"><Gifts /></Localized></Route>
      <Route path="/en/gifts"><Localized language="en" seoKey="gifts"><Gifts /></Localized></Route>
      <Route path="/ar/contact"><Localized language="ar" seoKey="contact"><Contact /></Localized></Route>
      <Route path="/en/contact"><Localized language="en" seoKey="contact"><Contact /></Localized></Route>
      <Route path="/ar/project/vip-bot-plan"><Localized language="ar" seoKey="vip-bot-plan"><VipTradingBotPlanArabic /></Localized></Route>
      <Route path="/en/project/vip-bot-plan"><Localized language="en" seoKey="vip-bot-plan"><VipTradingBotPlanEnglish /></Localized></Route>
      <Route path="/business-owner/vip-trading-bot-plan"><LegacyPublicRedirect /></Route>
      <Route path="/vip-trading-bot-plan">
        <Redirect to="/ar/project/vip-bot-plan" />
      </Route>
      <Route path="/ar/terms"><Localized language="ar" seoKey="terms"><TermsOfService /></Localized></Route>
      <Route path="/en/terms"><Localized language="en" seoKey="terms"><TermsOfService /></Localized></Route>
      <Route path="/ar/privacy"><Localized language="ar" seoKey="privacy"><PrivacyPolicy /></Localized></Route>
      <Route path="/en/privacy"><Localized language="en" seoKey="privacy"><PrivacyPolicy /></Localized></Route>
      <Route path="/ar/refund-policy"><Localized language="ar" seoKey="refund-policy"><RefundPolicy /></Localized></Route>
      <Route path="/en/refund-policy"><Localized language="en" seoKey="refund-policy"><RefundPolicy /></Localized></Route>
      <Route path="/ar/faq"><Localized language="ar" seoKey="faq"><FAQ /></Localized></Route>
      <Route path="/en/faq"><Localized language="en" seoKey="faq"><FAQ /></Localized></Route>
      <Route path="/ar/careers"><Localized language="ar" seoKey="careers"><Careers /></Localized></Route>
      <Route path="/en/careers"><Localized language="en" seoKey="careers"><Careers /></Localized></Route>
      <Route path="/ar/editorial-policy"><Localized language="ar" seoKey="editorial-policy"><TrustCenter page="editorial" /></Localized></Route>
      <Route path="/en/editorial-policy"><Localized language="en" seoKey="editorial-policy"><TrustCenter page="editorial" /></Localized></Route>
      <Route path="/ar/risk-disclosure"><Localized language="ar" seoKey="risk-disclosure"><TrustCenter page="risk" /></Localized></Route>
      <Route path="/en/risk-disclosure"><Localized language="en" seoKey="risk-disclosure"><TrustCenter page="risk" /></Localized></Route>
      <Route path="/ar/authors/xflex-editorial-team"><Localized language="ar" seoKey="author-editorial-team"><TrustCenter page="author" /></Localized></Route>
      <Route path="/en/authors/xflex-editorial-team"><Localized language="en" seoKey="author-editorial-team"><TrustCenter page="author" /></Localized></Route>
      <Route path="/about"><LegacyPublicRedirect /></Route>
      <Route path="/events"><LegacyPublicRedirect /></Route>
      <Route path="/articles"><LegacyPublicRedirect /></Route>
      <Route path="/articles/:slug"><LegacyPublicRedirect /></Route>
      <Route path="/free-content"><LegacyPublicRedirect /></Route>
      <Route path="/gifts"><LegacyPublicRedirect /></Route>
      <Route path="/contact"><LegacyPublicRedirect /></Route>
      <Route path="/terms"><LegacyPublicRedirect /></Route>
      <Route path="/privacy"><LegacyPublicRedirect /></Route>
      <Route path="/refund-policy"><LegacyPublicRedirect /></Route>
      <Route path="/faq"><LegacyPublicRedirect /></Route>
      <Route path="/careers"><LegacyPublicRedirect /></Route>
      <Route path="/editorial-policy"><LegacyPublicRedirect /></Route>
      <Route path="/risk-disclosure"><LegacyPublicRedirect /></Route>
      <Route path="/authors/xflex-editorial-team"><LegacyPublicRedirect /></Route>
      <Route path="/admin/jobs">
        <AdminRoute>
          <AdminJobs />
        </AdminRoute>
      </Route>
      <Route path="/admin/reviews">
        <AdminRoute>
          <AdminReviews />
        </AdminRoute>
      </Route>
      <Route path="/admin/notifications">
        <AdminRoute>
          <AdminNotifications />
        </AdminRoute>
      </Route>
      <Route path="/admin/email-logs">
        <AdminRoute>
          <AdminEmailLogs />
        </AdminRoute>
      </Route>
      <Route path="/admin/bug-reports">
        <AdminRoute>
          <AdminBugReports />
        </AdminRoute>
      </Route>
      <Route path="/admin/settings">
        <AdminRoute>
          <AdminSettings />
        </AdminRoute>
      </Route>
      <Route path="/admin/points">
        <AdminRoute>
          <AdminPoints />
        </AdminRoute>
      </Route>
      <Route path="/admin/engagement">
        <AdminRoute>
          <AdminEngagement />
        </AdminRoute>
      </Route>
      <Route path="/admin/monitoring">
        <AdminRoute>
          <AdminMonitoring />
        </AdminRoute>
      </Route>
      <Route path="/orders">
        <ProtectedRoute>
          <MyOrders />
        </ProtectedRoute>
      </Route>
      <Route path="/orders/:id">
        <ProtectedRoute>
          <OrderDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/subscriptions">
        <Redirect to="/my-packages" />
      </Route>
      <Route path="/my-packages">
        <ProtectedRoute>
          <StudentPackages />
        </ProtectedRoute>
      </Route>
      <Route path="/brokers">
        <ProtectedRoute>
          <BrokerSelection />
        </ProtectedRoute>
      </Route>
      <Route path="/broker-onboarding">
        <ProtectedRoute>
          <BrokerOnboarding />
        </ProtectedRoute>
      </Route>
      <Route path="/upgrade">
        <ProtectedRoute>
          <Upgrade />
        </ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute>
          <NotificationCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/my-points">
        <ProtectedRoute>
          <LoyaltyPoints />
        </ProtectedRoute>
      </Route>
      <Route path="/calculators">
        <ProtectedRoute>
          <TradingCalculators />
        </ProtectedRoute>
      </Route>
      <Route path="/ar"><Localized language="ar" seoKey="home"><Home /></Localized></Route>
      <Route path="/en"><Localized language="en" seoKey="home"><Home /></Localized></Route>
      <Route path="/"><LegacyPublicRedirect /></Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster />
            <AnalyticsTracker />
            <SessionGuard />
            <Router />
            <WhatsAppFloat />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
