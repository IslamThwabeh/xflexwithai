import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Users, BookOpen, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

function formatSafeDate(
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "N/A"
) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, pattern);
}

export default function AdminUsers() {
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollments.listAll.useQuery();

  const isLoading = usersLoading || enrollmentsLoading;

  // Calculate statistics
  const totalUsers = users?.length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const activeSubscriptions = enrollments?.filter(e => e.enrollment.isSubscriptionActive).length || 0;
  const totalRevenue = enrollments?.reduce((sum, e) => sum + (e.enrollment.paymentAmount || 0), 0) || 0;

  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.users')}</h1>
          <p className="text-muted-foreground">{t('admin.users.subtitle')}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">{t('admin.users.registeredStudents')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.users.totalEnrollments')}</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground">{t('admin.users.enrollmentsSub')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.users.activeSubs')}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">{t('admin.users.currentlyActive')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{t('admin.users.allTimeRevenue')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.users.registeredUsers')}</CardTitle>
            <CardDescription>{t('admin.users.allUsersDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-center py-8 text-muted-foreground">{t('admin.loading')}</p>
            ) : !users || users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t('admin.users.noUsers')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.users.name')}</TableHead>
                    <TableHead>{t('admin.users.email')}</TableHead>
                    <TableHead>{t('admin.users.phone')}</TableHead>
                    <TableHead>{t('admin.users.joined')}</TableHead>
                    <TableHead>{t('admin.users.lastSignIn')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                      <TableCell>{user.email || "N/A"}</TableCell>
                      <TableCell>{user.phone || "N/A"}</TableCell>
                      <TableCell>{formatSafeDate(user.createdAt, "MMM d, yyyy")}</TableCell>
                      <TableCell>{formatSafeDate(user.lastSignedIn, "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Enrollments Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.users.courseEnrollments')}</CardTitle>
            <CardDescription>{t('admin.users.enrollmentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentsLoading ? (
              <p className="text-center py-8 text-muted-foreground">{t('admin.loading')}</p>
            ) : !enrollments || enrollments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t('admin.users.noEnrollments')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.users.user')}</TableHead>
                    <TableHead>{t('admin.users.course')}</TableHead>
                    <TableHead>{t('admin.users.progress')}</TableHead>
                    <TableHead>{t('admin.users.payment')}</TableHead>
                    <TableHead>{t('admin.users.status')}</TableHead>
                    <TableHead>{t('admin.users.enrolled')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.user?.name || "Unknown User"}
                      </TableCell>
                      <TableCell>{enrollment.course?.titleEn || "Unknown Course"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${enrollment.enrollment.progressPercentage || 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {enrollment.enrollment.progressPercentage || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {enrollment.enrollment.paymentAmount ? (
                          <span className="font-medium">
                            ${enrollment.enrollment.paymentAmount.toFixed(2)} {enrollment.enrollment.paymentCurrency}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t('admin.users.free')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={enrollment.enrollment.isSubscriptionActive ? "default" : "secondary"}>
                          {enrollment.enrollment.isSubscriptionActive ? t('admin.users.active') : t('admin.users.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatSafeDate(enrollment.enrollment.enrolledAt, "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
