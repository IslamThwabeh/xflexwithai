import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { PauseCircle, PlayCircle, Search } from "lucide-react";

export default function AdminLexaiSubscriptions() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [freezeDialogUserId, setFreezeDialogUserId] = useState<number | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeDays, setFreezeDays] = useState("");

  const holdersQuery = trpc.packageKeys.lexaiHolders.useQuery();

  const freezeAll = trpc.packageKeys.freeze.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تجميد الاشتراكات' : 'Subscriptions frozen');
      setFreezeDialogUserId(null);
      setFreezeReason("");
      setFreezeDays("");
      holdersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unfreezeAll = trpc.packageKeys.unfreeze.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم استئناف الاشتراكات' : 'Subscriptions resumed');
      holdersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const pauseLexai = trpc.lexaiAdmin.pauseSubscription.useMutation({
    onSuccess: () => { toast.success(language === 'ar' ? 'تم إيقاف LexAI' : 'LexAI paused'); holdersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const resumeLexai = trpc.lexaiAdmin.resumeSubscription.useMutation({
    onSuccess: () => { toast.success(language === 'ar' ? 'تم استئناف LexAI' : 'LexAI resumed'); holdersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const pauseRec = trpc.recommendations.subscriptions.pause.useMutation({
    onSuccess: () => { toast.success(language === 'ar' ? 'تم إيقاف التوصيات' : 'Recommendations paused'); holdersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const resumeRec = trpc.recommendations.subscriptions.resume.useMutation({
    onSuccess: () => { toast.success(language === 'ar' ? 'تم استئناف التوصيات' : 'Recommendations resumed'); holdersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const holders = holdersQuery.data ?? [];
  const filtered = holders.filter(h =>
    !searchQuery ||
    (h.userEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.userName ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'حاملو الباقة الشاملة' : 'Comprehensive Package Holders'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar'
              ? 'إدارة اشتراكات LexAI والتوصيات لحاملي الباقة الشاملة'
              : 'Manage LexAI & Recommendations subscriptions for Comprehensive package holders'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {holdersQuery.isLoading ? (
              <p className="text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
            ) : (
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                      <TableHead>LexAI</TableHead>
                      <TableHead>{language === 'ar' ? 'التوصيات' : 'Recommendations'}</TableHead>
                      <TableHead>{language === 'ar' ? 'تجميد الكل' : 'Freeze All'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((h) => {
                      const lexaiPaused = !!h.lexaiIsPaused;
                      const recPaused = !!h.recIsPaused;
                      const hasLexai = !!h.lexaiSubId;
                      const hasRec = !!h.recSubId;
                      const bothPaused = lexaiPaused && recPaused;

                      return (
                        <TableRow key={h.keyId}>
                          {/* User */}
                          <TableCell>
                            <div className="font-medium text-sm">{h.userName || '—'}</div>
                            <div className="text-xs text-muted-foreground">{h.userEmail}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{h.packageName}</div>
                          </TableCell>

                          {/* LexAI column: status + individual toggle */}
                          <TableCell>
                            {hasLexai ? (
                              <div className="flex items-center gap-2">
                                <div>
                                  <Badge className={lexaiPaused
                                    ? "bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs"
                                    : "bg-green-100 text-green-800 hover:bg-green-100 text-xs"}>
                                    {lexaiPaused
                                      ? (language === 'ar' ? 'متوقف' : 'Paused')
                                      : (language === 'ar' ? 'نشط' : 'Active')}
                                  </Badge>
                                  {h.lexaiEndDate && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {new Date(h.lexaiEndDate).toLocaleDateString()}
                                    </div>
                                  )}
                                  {lexaiPaused && h.lexaiPausedRemainingDays ? (
                                    <div className="text-xs text-emerald-600">{h.lexaiPausedRemainingDays}d {language === 'ar' ? 'متبقية' : 'left'}</div>
                                  ) : null}
                                </div>
                                {h.lexaiSubId && (
                                  lexaiPaused ? (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => resumeLexai.mutate({ subscriptionId: h.lexaiSubId! })}
                                      disabled={resumeLexai.isPending}
                                      title={language === 'ar' ? 'استئناف LexAI فقط' : 'Resume LexAI only'}>
                                      <PlayCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600 hover:bg-amber-50"
                                      onClick={() => pauseLexai.mutate({ subscriptionId: h.lexaiSubId! })}
                                      disabled={pauseLexai.isPending}
                                      title={language === 'ar' ? 'إيقاف LexAI فقط' : 'Pause LexAI only'}>
                                      <PauseCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>

                          {/* Rec column: status + individual toggle */}
                          <TableCell>
                            {hasRec ? (
                              <div className="flex items-center gap-2">
                                <div>
                                  <Badge className={recPaused
                                    ? "bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs"
                                    : "bg-green-100 text-green-800 hover:bg-green-100 text-xs"}>
                                    {recPaused
                                      ? (language === 'ar' ? 'متوقف' : 'Paused')
                                      : (language === 'ar' ? 'نشط' : 'Active')}
                                  </Badge>
                                  {h.recEndDate && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {new Date(h.recEndDate).toLocaleDateString()}
                                    </div>
                                  )}
                                  {recPaused && h.recPausedRemainingDays ? (
                                    <div className="text-xs text-emerald-600">{h.recPausedRemainingDays}d {language === 'ar' ? 'متبقية' : 'left'}</div>
                                  ) : null}
                                </div>
                                {h.recSubId && (
                                  recPaused ? (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => resumeRec.mutate({ subscriptionId: h.recSubId! })}
                                      disabled={resumeRec.isPending}
                                      title={language === 'ar' ? 'استئناف التوصيات فقط' : 'Resume Rec only'}>
                                      <PlayCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600 hover:bg-amber-50"
                                      onClick={() => pauseRec.mutate({ subscriptionId: h.recSubId! })}
                                      disabled={pauseRec.isPending}
                                      title={language === 'ar' ? 'إيقاف التوصيات فقط' : 'Pause Rec only'}>
                                      <PauseCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>

                          {/* Freeze All / Unfreeze All */}
                          <TableCell>
                            {h.userId && (
                              bothPaused ? (
                                <Button variant="ghost" size="sm"
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => unfreezeAll.mutate({ userId: h.userId! })}
                                  disabled={unfreezeAll.isPending}
                                  title={language === 'ar' ? 'استئناف الكل' : 'Unfreeze all'}>
                                  <PlayCircle className="w-4 h-4 mr-1" />
                                  {language === 'ar' ? 'استئناف' : 'Unfreeze'}
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => setFreezeDialogUserId(h.userId!)}
                                  disabled={freezeAll.isPending}
                                  title={language === 'ar' ? 'تجميد الكل' : 'Freeze all'}>
                                  <PauseCircle className="w-4 h-4 mr-1" />
                                  {language === 'ar' ? 'تجميد' : 'Freeze'}
                                </Button>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </CardContent>
        </Card>

        {/* Freeze All Dialog */}
        <Dialog open={!!freezeDialogUserId} onOpenChange={(open) => { if (!open) { setFreezeDialogUserId(null); setFreezeReason(""); setFreezeDays(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'تجميد الاشتراكات' : 'Freeze Subscriptions'}</DialogTitle>
              <DialogDescription>
                {language === 'ar'
                  ? 'سيتم إيقاف اشتراكات LexAI والتوصيات مؤقتًا.'
                  : 'LexAI and recommendation subscriptions will be paused.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{language === 'ar' ? 'سبب التجميد (اختياري)' : 'Reason (optional)'}</Label>
                <Textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل السبب...' : 'Enter reason...'}
                  rows={2}
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'مدة التجميد بالأيام (فارغ = تجميد دائم)' : 'Duration in days (empty = indefinite freeze)'}</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={freezeDays}
                  onChange={(e) => setFreezeDays(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: 30' : 'e.g. 30'}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setFreezeDialogUserId(null); setFreezeReason(""); setFreezeDays(""); }}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700"
                disabled={freezeAll.isPending}
                onClick={() => {
                  if (freezeDialogUserId) {
                    freezeAll.mutate({
                      userId: freezeDialogUserId,
                      reason: freezeReason.trim() || undefined,
                      frozenUntilDays: freezeDays ? parseInt(freezeDays, 10) : undefined,
                    });
                  }
                }}
              >
                {freezeAll.isPending
                  ? (language === 'ar' ? 'جارٍ...' : 'Freezing...')
                  : (language === 'ar' ? 'تجميد' : 'Freeze')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
