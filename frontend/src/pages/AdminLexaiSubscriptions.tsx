import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { PauseCircle, PlayCircle } from "lucide-react";

function formatSafeDate(
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "-"
) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, pattern);
}

export default function AdminLexaiSubscriptions() {
  const { data: subscriptions, isLoading } = trpc.lexaiAdmin.subscriptions.useQuery();
  const { t } = useLanguage();
  const utils = trpc.useUtils();

  const pauseMutation = trpc.lexaiAdmin.pauseSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription paused");
      utils.lexaiAdmin.subscriptions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeMutation = trpc.lexaiAdmin.resumeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription resumed");
      utils.lexaiAdmin.subscriptions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.lexai.subscriptions')}</h1>
        <p className="text-muted-foreground">{t('admin.lexai.subsSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.lexai.subscriptions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t('admin.loading')}</p>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.lexai.noSubs')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.lexai.user')}</TableHead>
                  <TableHead>{t('admin.lexai.email')}</TableHead>
                  <TableHead>{t('admin.lexai.status')}</TableHead>
                  <TableHead>{t('admin.lexai.messages')}</TableHead>
                  <TableHead>{t('admin.lexai.ends')}</TableHead>
                  <TableHead>Paused Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const endDate = sub.endDate ? new Date(sub.endDate) : null;
                  const isValidEndDate = endDate ? !Number.isNaN(endDate.getTime()) : false;
                  const isExpired = isValidEndDate && endDate ? endDate.getTime() < Date.now() : false;
                  const isPaused = Boolean((sub as any).isPaused);
                  const isActiveStatus = sub.isActive && !isPaused && !isExpired;

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.userName || "Unknown"}</TableCell>
                      <TableCell>{sub.userEmail || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={isActiveStatus ? "default" : "secondary"}>
                          {isPaused ? 'Paused' : isActiveStatus ? t('admin.lexai.active') : t('admin.lexai.expired')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.messagesUsed} / {sub.messagesLimit}
                      </TableCell>
                      <TableCell>
                        {formatSafeDate(sub.endDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{(sub as any).pausedRemainingDays ? `${(sub as any).pausedRemainingDays}d` : '-'}</TableCell>
                      <TableCell>
                        {isPaused ? (
                          <Button size="sm" variant="outline" onClick={() => resumeMutation.mutate({ subscriptionId: sub.id })}>
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate({ subscriptionId: sub.id })}>
                            <PauseCircle className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
