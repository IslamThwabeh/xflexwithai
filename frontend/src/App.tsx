import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import MyDashboard from "./pages/MyDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCourses from "./pages/AdminCourses";
import AdminEpisodes from "./pages/AdminEpisodes";
import AdminUsers from "./pages/AdminUsers";
import AdminKeys from "./pages/AdminKeys";
import CourseWatch from "./pages/CourseWatch";
import CoursePlayer from "./pages/CoursePlayer";
import ActivateKey from "./pages/ActivateKey";
import LexAI from "./pages/LexAI";
import Auth from "./pages/Auth";
import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminSettings from "./pages/AdminSettings";
import QuizLevels from "./pages/QuizLevels";
import TakeQuiz from "./pages/TakeQuiz";
import QuizHistory from "./pages/QuizHistory";
import AdminLexaiSubscriptions from "./pages/AdminLexaiSubscriptions";
import AdminLexaiKeys from "./pages/AdminLexaiKeys";
import AdminLexaiConversations from "./pages/AdminLexaiConversations";
import Recommendations from "./pages/Recommendations";
import AdminRecommendations from "./pages/AdminRecommendations";
import SupportChat from "./pages/SupportChat";
import AdminSupport from "./pages/AdminSupport";
import AdminRoles from "./pages/AdminRoles";
import StaffPortal from "./pages/StaffPortal";

function Router() {
  return (
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
      <Route path={"/admin/users"}>
        <AdminRoute>
          <AdminUsers />
        </AdminRoute>
      </Route>
      <Route path={"/admin/keys"}>
        <AdminRoute>
          <AdminKeys />
        </AdminRoute>
      </Route>
      <Route path={"/admin/analytics"}>
        <AdminRoute>
          <AdminAnalytics />
        </AdminRoute>
      </Route>
      <Route path={"/admin/settings"}>
        <AdminRoute>
          <AdminSettings />
        </AdminRoute>
      </Route>
      <Route path={"/admin/lexai/subscriptions"}>
        <AdminRoute>
          <AdminLexaiSubscriptions />
        </AdminRoute>
      </Route>
      <Route path={"/admin/lexai/keys"}>
        <AdminRoute>
          <AdminLexaiKeys />
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
      <Route path={"/staff"}>
        <ProtectedRoute>
          <StaffPortal />
        </ProtectedRoute>
      </Route>
      <Route path="/quiz" component={QuizLevels} />
      <Route path="/quiz/:level" component={TakeQuiz} />
      <Route path="/quiz/:level/history" component={QuizHistory} />
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;

