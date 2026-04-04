import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { lazy, Suspense } from "react";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import WhatsAppFloat from "./components/WhatsAppFloat";
import SessionGuard from "./components/SessionGuard";
import { AdminTableSkeleton, DetailPageSkeleton, TextPageSkeleton, PageWithCardsSkeleton } from "./components/PageSkeletons";

// Eagerly loaded (critical path)
// Home, Auth are loaded above

// Lazy-loaded admin pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminEpisodes = lazy(() => import("./pages/AdminEpisodes"));
const AdminUsers = lazy(() => import("./pages/AdminStudents"));
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
const AdminSubscribersReport = lazy(() => import("./pages/AdminStudents"));
const AdminRevenueReport = lazy(() => import("./pages/AdminRevenueReport"));
const AdminExpiryReport = lazy(() => import("./pages/AdminExpiryReport"));
const AdminPackageKeys = lazy(() => import("./pages/AdminPackageKeys"));

// Lazy-loaded user pages
const MyDashboard = lazy(() => import("./pages/MyDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
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
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Careers = lazy(() => import("./pages/Careers"));
const AdminJobs = lazy(() => import("./pages/AdminJobs"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminPoints = lazy(() => import("./pages/AdminPoints"));
const AdminEngagement = lazy(() => import("./pages/AdminEngagement"));
const AdminOfferAgreements = lazy(() => import("./pages/AdminOfferAgreements"));
const AdminPlanProgress = lazy(() => import("./pages/AdminPlanProgress"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const LoyaltyPoints = lazy(() => import("./pages/LoyaltyPoints"));
const TradingCalculators = lazy(() => import("./pages/TradingCalculators"));

// Minimal fallback spinner
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path={"/auth"} component={Auth} />
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/dashboard"}>
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/courses"}>
        <ProtectedRoute>
          <MyDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/profile"}>
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path={"/admin"}>
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
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
          <AdminUsers />
        </AdminRoute>
      </Route>
      <Route path={"/admin/users"}>
        <AdminRoute>
          <AdminUsers />
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
      <Route path={"/admin/plan-progress"}>
        <AdminRoute>
          <AdminPlanProgress />
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
      <Route path="/packages/:slug" component={PackageDetails} />
      <Route path="/checkout/:slug" component={Checkout} />
      <Route path="/about" component={About} />
      <Route path="/events" component={Events} />
      <Route path="/articles" component={Articles} />
      <Route path="/articles/:slug" component={ArticleDetail} />
      <Route path="/free-content" component={FreeContent} />
      <Route path="/gifts" component={Gifts} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/faq" component={FAQ} />
      <Route path="/careers" component={Careers} />
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
      <Route path={"/"} component={Home} />
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

