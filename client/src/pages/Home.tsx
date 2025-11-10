import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, TrendingUp, Users, Video, Award, ArrowRight, Star } from "lucide-react";
import { Link } from "wouter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { data: courses, isLoading } = trpc.courses.list.useQuery();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
              <LanguageSwitcher />
              {isAuthenticated ? (
                <>
                  {adminCheck?.isAdmin && (
                    <Link href="/admin">
                      <Button variant="ghost">{t('nav.adminPanel')}</Button>
                    </Link>
                  )}
            <Link href="/dashboard">
              <Button variant="ghost">{t('nav.myCourses')}</Button>
            </Link>
            <Link href="/lexai">
              <Button variant="ghost" className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('nav.lexai')}
              </Button>
            </Link>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="text-sm font-medium">{user?.name}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <a href={getLoginUrl()}>
                    <Button variant="ghost">{t('nav.login')}</Button>
                  </a>
                  <a href={getLoginUrl()}>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                      Start Learning Free
                    </Button>
                  </a>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section - Registration First */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6TTEyIDM0YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00ek0yNCAzNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bTAtMTBjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
        
        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Value Proposition */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                {t('home.hero.title')}
                <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  {t('home.hero.subtitle')}
                </span>
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                {t('home.hero.description')}
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <a href={getLoginUrl()}>
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-6 text-lg">
                    <BookOpen className="mr-2 h-5 w-5" />
                    {t('home.hero.browseCourses')}
                  </Button>
                </a>
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg">
                    {t('home.hero.startTrial')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8">
                <div>
                  <div className="text-3xl font-bold">10K+</div>
                  <div className="text-blue-200 text-sm">{t('home.hero.activeStudents')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">50+</div>
                  <div className="text-blue-200 text-sm">{t('home.hero.expertCourses')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">4.9</div>
                  <div className="text-blue-200 text-sm flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                    {t('home.hero.rating')}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Registration Card */}
            <Card className="shadow-2xl border-0">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Get Started Today</CardTitle>
                <CardDescription>
                  Join thousands of successful traders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Input 
                    placeholder="Enter your email" 
                    type="email"
                    className="h-12"
                    disabled
                  />
                  <Input 
                    placeholder="Choose a password" 
                    type="password"
                    className="h-12"
                    disabled
                  />
                </div>
                
                <a href={getLoginUrl()} className="block">
                  <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg font-semibold">
                    Create Free Account
                  </Button>
                </a>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a href={getLoginUrl()} className="text-blue-600 hover:underline font-medium">
                    Sign in
                  </a>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4 text-green-600" />
                    <span>30-day money-back guarantee</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose XFlex Academy?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to become a successful trader in one place
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-blue-500 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <Video className="h-7 w-7 text-blue-600" />
                </div>
                <CardTitle>Expert-Led Courses</CardTitle>
                <CardDescription>
                  Learn from experienced traders with proven track records in the markets
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-purple-500 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                  <TrendingUp className="h-7 w-7 text-purple-600" />
                </div>
                <CardTitle>Practical Strategies</CardTitle>
                <CardDescription>
                  Apply real-world trading strategies that work in today's markets
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-green-500 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-green-600" />
                </div>
                <CardTitle>Lifetime Access</CardTitle>
                <CardDescription>
                  Get unlimited access to course materials and future updates
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Available Courses Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Available Courses</h2>
            <p className="text-xl text-muted-foreground">
              Choose from our selection of trading courses designed for all skill levels
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8">
              {courses.map((course) => (
                <Card key={course.id} className="hover:shadow-xl transition-all border-2 hover:border-blue-500">
                  <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <BookOpen className="h-16 w-16 text-white opacity-50" />
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                        {course.level}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">4.8</span>
                      </div>
                    </div>
                    <CardTitle className="line-clamp-2">{course.titleEn}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {course.descriptionEn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          ${course.price}
                        </div>
                        <div className="text-xs text-muted-foreground">One-time payment</div>
                      </div>
                      <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        Enroll Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="max-w-md mx-auto text-center py-12">
              <CardContent>
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No courses available yet. Check back soon!
                </p>
                {adminCheck?.isAdmin && (
                  <Link href="/admin/courses">
                    <Button>Add Your First Course</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-6 w-6" />
                <span className="text-xl font-bold">{APP_TITLE}</span>
              </div>
              <p className="text-gray-400 text-sm">
                Empowering traders worldwide with expert knowledge and practical skills.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Courses</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Newsletter</h3>
              <p className="text-sm text-gray-400 mb-4">
                Subscribe to get trading tips and course updates
              </p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Your email" 
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled
                />
                <Button variant="secondary">Subscribe</Button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-400">
            © 2025 {APP_TITLE}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
