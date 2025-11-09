import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, TrendingUp, LogIn } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: courses, isLoading } = trpc.courses.list.useQuery();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <span className="text-xl font-bold">{APP_TITLE}</span>
          </div>
          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="ghost">Admin Panel</Button>
                  </Link>
                )}
                <Link href="/my-courses">
                  <Button variant="ghost">My Courses</Button>
                </Link>
                <span className="text-sm text-muted-foreground">{user?.name}</span>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-background py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-5xl font-bold tracking-tight">
              Master Trading with XFlex Academy
            </h1>
            <p className="text-xl text-muted-foreground">
              Learn from industry experts and take your trading skills to the next level with our comprehensive courses
            </p>
            <div className="flex gap-4 justify-center">
              <a href="#courses">
                <Button size="lg">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Browse Courses
                </Button>
              </a>
              {!isAuthenticated && (
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="outline">
                    Get Started
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold">Expert-Led Courses</h3>
              <p className="text-muted-foreground">
                Learn from experienced traders with proven track records
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">Practical Strategies</h3>
              <p className="text-muted-foreground">
                Apply real-world trading strategies that work in today's markets
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold">Lifetime Access</h3>
              <p className="text-muted-foreground">
                Get unlimited access to course materials and future updates
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section id="courses" className="py-16 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Available Courses</h2>
            <p className="text-muted-foreground">
              Choose from our selection of trading courses designed for all skill levels
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          ) : !courses || courses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No courses available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card key={course.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{course.titleEn}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.descriptionEn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{course.level}</span>
                      <span className="font-semibold text-lg">
                        ${(course.price / 100).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/course/${course.id}`} className="w-full">
                      <Button className="w-full">View Course</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {APP_TITLE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
