import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PauseCircle, PlayCircle, UserCog } from "lucide-react";

export default function AdminRecommendations() {
  const [search, setSearch] = useState("");
  const { t, isRTL } = useLanguage();

  const utils = trpc.useUtils();

  const { data: users = [] } = trpc.users.list.useQuery();
  const { data: analysts = [] } = trpc.recommendationAdmin.listAnalysts.useQuery();
  const { data: subscriptions = [] } = trpc.recommendationAdmin.subscriptions.list.useQuery();

  const analystIds = useMemo(() => new Set(analysts.map((a: any) => a.id)), [analysts]);

  const setAnalystMutation = trpc.recommendationAdmin.setAnalyst.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث صلاحية المحلل");
      utils.recommendationAdmin.listAnalysts.invalidate();
      utils.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseSubscriptionMutation = trpc.recommendationAdmin.subscriptions.pause.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف الاشتراك مؤقتاً");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeSubscriptionMutation = trpc.recommendationAdmin.subscriptions.resume.useMutation({
    onSuccess: () => {
      toast.success("تم استئناف الاشتراك");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredUsers = users.filter((user: any) => {
    const value = search.toLowerCase();
    return (user.name || "").toLowerCase().includes(value) || (user.email || "").toLowerCase().includes(value);
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div>
          <h1 className="text-3xl font-bold">{t('admin.rec.title')}</h1>
          <p className="text-muted-foreground">{t('admin.rec.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> {t('admin.rec.assignAnalyst')}</CardTitle>
            <CardDescription>{t('admin.rec.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder={t('admin.rec.searchUser')} value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="space-y-2">
              {filteredUsers.slice(0, 100).map((user: any) => {
                const isAnalyst = analystIds.has(user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <p className="font-medium">{user.name || "-"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      variant={isAnalyst ? "destructive" : "default"}
                      onClick={() => setAnalystMutation.mutate({ userId: user.id, enabled: !isAnalyst })}
                    >
                      {isAnalyst ? t('admin.rec.removeAnalyst') : t('admin.rec.setAnalyst')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'اشتراكات التوصيات' : 'Recommendation Subscriptions'}</CardTitle>
            <CardDescription>{isRTL ? 'إيقاف أو استئناف الاشتراكات النشطة مؤقتاً' : 'Temporarily pause or resume active recommendation access'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                  <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'ينتهي' : 'Ends'}</TableHead>
                  <TableHead>{isRTL ? 'المتبقي عند الإيقاف' : 'Paused balance'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription: any) => (
                  <TableRow key={subscription.id}>
                    <TableCell>{subscription.userName || '-'}</TableCell>
                    <TableCell>{subscription.userEmail || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={subscription.isPaused ? 'secondary' : 'default'}>
                        {subscription.isPaused ? (isRTL ? 'موقوف مؤقتاً' : 'Paused') : (isRTL ? 'نشط' : 'Active')}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString(isRTL ? 'ar-EG' : undefined) : '-'}</TableCell>
                    <TableCell>{subscription.pausedRemainingDays ? `${subscription.pausedRemainingDays}d` : '-'}</TableCell>
                    <TableCell>
                      {subscription.isPaused ? (
                        <Button size="sm" variant="outline" onClick={() => resumeSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'استئناف' : 'Resume'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => pauseSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'إيقاف مؤقت' : 'Pause'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
