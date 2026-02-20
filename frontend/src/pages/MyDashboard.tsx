import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, Play, CheckCircle2, Clock, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

export default function MyDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const didSyncRef = useRef(false);

  const syncEntitlements = trpc.users.syncEntitlements.useMutation();

  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollments.myEnrollments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: lexaiSubscription } = trpc.lexai.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.email) return;
    if (didSyncRef.current) return;

    didSyncRef.current = true;
    syncEntitlements
      .mutateAsync()
      .then(async () => {
        await utils.enrollments.myEnrollments.invalidate();
        await utils.lexai.getSubscription.invalidate();
      })
      .catch(() => {
        // best-effort
      });
  }, [isAuthenticated, syncEntitlements, user?.email, utils.enrollments.myEnrollments, utils.lexai.getSubscription]);

  if (loading || enrollmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-blue-600 mb-4" />
            <CardTitle className="text-2xl">Welcome to {APP_TITLE}</CardTitle>
            <CardDescription>
              Please sign in to access your learning dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full" size="lg">
                Sign In to Continue
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter(e => e.completedAt !== null).length || 0;
  const inProgressCourses = totalCourses - completedCourses;
  const averageProgress = totalCourses > 0
    ? enrollments!.reduce((sum, e) => sum + (e.progressPercentage || 0), 0) / totalCourses
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <GraduationCap className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {APP_TITLE}
                </span>
              </div>
            </Link>
            
            <nav className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Home
                </Button>
              </Link>
			  
			    <Link href="/quiz">
					<Button variant="ghost">
					<BookOpen className="mr-2 h-4 w-4" />
					الاختبارات
				</Button>
				</Link>

        <Link href="/lexai">
          <Button variant="ghost">
            <Sparkles className="mr-2 h-4 w-4" />
            LexAI
          </Button>
        </Link>
  
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium">{user?.name}</span>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div>
            <h1 className="text-4xl font-bold mb-2">
              Welcome back, {user?.name?.split(' ')[0] || 'Student'}! 👋
            </h1>
            <p className="text-xl text-muted-foreground">
              Continue your learning journey
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCourses}</div>
                <p className="text-xs text-muted-foreground">Enrolled courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressCourses}</div>
                <p className="text-xs text-muted-foreground">Active learning</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedCourses}</div>
                <p className="text-xs text-muted-foreground">Finished courses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Progress</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(averageProgress)}%</div>
                <p className="text-xs text-muted-foreground">Overall completion</p>
              </CardContent>
            </Card>
          </div>

          {/* Access Summary */}
          <Card>
            <CardHeader>
              <CardTitle>My Access</CardTitle>
              <CardDescription>
                Your course access and LexAI status are linked to your email.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                LexAI: {lexaiSubscription ? 'Active' : 'Not active'}
              </div>
              <Link href="/lexai">
                <Button variant="outline">Open LexAI</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Enrolled Courses */}
          <div>
            <h2 className="text-2xl font-bold mb-4">My Courses</h2>
            
            {!enrollments || enrollments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start learning by enrolling in a course
                  </p>
                  <Link href="/">
                    <Button>Browse Courses</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {enrollments.map((enrollment) => {
                  const progress = enrollment.progressPercentage || 0;
                  const isCompleted = enrollment.completedAt !== null;

                  return (
                    <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                      <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center relative">
                        <BookOpen className="h-16 w-16 text-white opacity-50" />
                        {isCompleted && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(enrollment.enrolledAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <CardTitle className="line-clamp-2">{enrollment.courseName}</CardTitle>
                        <CardDescription className="line-clamp-2">Course</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-semibold">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {/* Episode Count */}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                              {enrollment.completedEpisodes} episodes completed
                            </span>
                          </div>

                          {/* Continue Button */}
                          <Link href={`/course/${enrollment.courseId}`}>
                            <Button className="w-full" variant={isCompleted ? "outline" : "default"}>
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Review Course
                                </>
                              ) : (
                                <>
                                  <Play className="mr-2 h-4 w-4" />
                                  Continue Learning
                                </>
                              )}
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
