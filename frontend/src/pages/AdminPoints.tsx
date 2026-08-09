import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminFeatureSetupCard,
  SafeAdminPreview,
} from "@/components/admin/SafeAdminPreview";
import {
  Award,
  Plus,
  Minus,
  Loader2,
  Trophy,
  Settings2,
  Users,
  Save,
  ToggleLeft,
  ToggleRight,
  Gift,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Eye,
  WalletCards,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Search,
  Pencil,
  UserRound,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Tab = "leaderboard" | "rules" | "referrals" | "rewards" | "preview";

type LoyaltyStudent = {
  id: number;
  name: string | null;
  email: string;
  pointsBalance: number;
};

type RewardDraftForm = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  pointsCost: number;
  stockQuantity: string;
  sortOrder: number;
};

const emptyRewardForm = (): RewardDraftForm => ({
  titleEn: "",
  titleAr: "",
  descriptionEn: "",
  descriptionAr: "",
  pointsCost: 100,
  stockQuantity: "",
  sortOrder: 0,
});

function getInitialPointsTab(): Tab {
  if (typeof window === "undefined") return "leaderboard";
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "student") return "preview";
  const requestedTab = params.get("tab");
  return ["leaderboard", "rules", "referrals", "rewards", "preview"].includes(
    requestedTab ?? "",
  ) ? requestedTab as Tab : "leaderboard";
}

export default function AdminPoints() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [initialTab] = useState<Tab>(getInitialPointsTab);
  const [tab, setTab] = useState<Tab>(initialTab);
  const directStudentPreview = initialTab === "preview";
  const [adjustment, setAdjustment] = useState<{
    mode: "award" | "deduct";
    student: LoyaltyStudent | null;
  } | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: "",
    reasonEn: "",
    reasonAr: "",
  });
  const [rewardEditor, setRewardEditor] = useState<{
    mode: "create" | "edit";
    id?: number;
  } | null>(null);
  const [rewardForm, setRewardForm] =
    useState<RewardDraftForm>(emptyRewardForm);
  const [visibilityItem, setVisibilityItem] = useState<any | null>(null);
  const [redemptionAction, setRedemptionAction] = useState<{
    action: "reject" | "fulfill";
    request: any;
  } | null>(null);
  const [redemptionNote, setRedemptionNote] = useState("");

  const { data: leaderboard, isLoading } = trpc.points.leaderboard.useQuery(
    undefined,
    { enabled: tab === "leaderboard" }
  );
  const {
    data: rules,
    isLoading: rulesLoading,
    refetch: refetchRules,
  } = trpc.points.adminRules.useQuery(undefined, { enabled: tab === "rules" });
  const { data: referralStats, isLoading: refStatsLoading } =
    trpc.points.referralStats.useQuery(undefined, {
      enabled: tab === "referrals",
    });
  const { data: rewardsAvailability } =
    trpc.points.rewardsAvailability.useQuery(undefined, {
      enabled: tab === "rewards" || tab === "preview",
    });
  const rewardsEnabled = Boolean(rewardsAvailability?.enabled);
  const {
    data: rewardItems,
    isLoading: rewardItemsLoading,
    refetch: refetchRewardItems,
  } = trpc.points.adminRewardItems.useQuery(undefined, {
    enabled: tab === "rewards",
    retry: false,
  });
  const {
    data: rewardRedemptions,
    isLoading: rewardRedemptionsLoading,
    refetch: refetchRewardRedemptions,
  } = trpc.points.adminRewardRedemptions.useQuery(
    { limit: 100 },
    {
      enabled: tab === "rewards" && rewardsEnabled,
      retry: false,
    }
  );
  const normalizedStudentSearch = studentSearch.trim();
  const studentSearchQuery = trpc.points.searchStudents.useQuery(
    { query: normalizedStudentSearch || "__", limit: 12 },
    {
      enabled: Boolean(
        adjustment && !adjustment.student && normalizedStudentSearch.length >= 2
      ),
      retry: false,
    }
  );

  const closeAdjustment = () => {
    setAdjustment(null);
    setStudentSearch("");
    setAdjustmentForm({ amount: "", reasonEn: "", reasonAr: "" });
  };

  const closeRedemptionAction = () => {
    setRedemptionAction(null);
    setRedemptionNote("");
  };

  const refreshPointBalances = async () => {
    await Promise.all([
      utils.points.leaderboard.invalidate(),
      utils.points.searchStudents.invalidate(),
    ]);
  };

  const awardMut = trpc.points.award.useMutation({
    onSuccess: async () => {
      await refreshPointBalances();
      toast.success(isRtl ? "تم منح النقاط" : "Points awarded");
      closeAdjustment();
    },
    onError: e => toast.error(e.message),
  });

  const deductMut = trpc.points.deduct.useMutation({
    onSuccess: async () => {
      await refreshPointBalances();
      toast.success(isRtl ? "تم خصم النقاط" : "Points deducted");
      closeAdjustment();
    },
    onError: e => toast.error(e.message),
  });

  const updateRuleMut = trpc.points.updateRule.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم تحديث القاعدة" : "Rule updated");
      refetchRules();
    },
    onError: e => toast.error(e.message),
  });

  const createRewardMut = trpc.points.createRewardItem.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم حفظ مسودة المكافأة" : "Reward draft saved");
      setRewardEditor(null);
      setRewardForm(emptyRewardForm());
      refetchRewardItems();
    },
    onError: e => toast.error(e.message),
  });

  const updateRewardMut = trpc.points.updateRewardItem.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم تحديث المكافأة" : "Reward updated");
      setRewardEditor(null);
      setVisibilityItem(null);
      refetchRewardItems();
    },
    onError: e => toast.error(e.message),
  });

  const reviewRewardMut = trpc.points.reviewRewardRedemption.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم تحديث الطلب" : "Redemption updated");
      closeRedemptionAction();
      refetchRewardRedemptions();
    },
    onError: e => toast.error(e.message),
  });

  const fulfillRewardMut = trpc.points.fulfillRewardRedemption.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم تنفيذ الطلب" : "Redemption fulfilled");
      closeRedemptionAction();
      refetchRewardRedemptions();
    },
    onError: e => toast.error(e.message),
  });

  const openAdjustment = (
    mode: "award" | "deduct",
    student: LoyaltyStudent | null = null
  ) => {
    setAdjustment({ mode, student });
    setStudentSearch("");
    setAdjustmentForm({ amount: "", reasonEn: "", reasonAr: "" });
  };

  const submitAdjustment = () => {
    if (!adjustment?.student) return;
    const amount = Number(adjustmentForm.amount);
    if (!Number.isInteger(amount) || amount < 1) return;
    const payload = {
      userId: adjustment.student.id,
      amount,
      reasonEn: adjustmentForm.reasonEn.trim(),
      reasonAr: adjustmentForm.reasonAr.trim(),
    };
    if (adjustment.mode === "award") {
      awardMut.mutate(payload);
    } else {
      deductMut.mutate(payload);
    }
  };

  const openRewardEditor = (item?: any) => {
    if (item) {
      setRewardEditor({ mode: "edit", id: item.id });
      setRewardForm({
        titleEn: item.titleEn,
        titleAr: item.titleAr,
        descriptionEn: item.descriptionEn ?? "",
        descriptionAr: item.descriptionAr ?? "",
        pointsCost: item.pointsCost,
        stockQuantity:
          item.stockQuantity === null ? "" : String(item.stockQuantity),
        sortOrder: item.sortOrder ?? 0,
      });
      return;
    }
    setRewardEditor({ mode: "create" });
    setRewardForm(emptyRewardForm());
  };

  const submitRewardEditor = () => {
    const payload = {
      titleEn: rewardForm.titleEn.trim(),
      titleAr: rewardForm.titleAr.trim(),
      descriptionEn: rewardForm.descriptionEn.trim() || null,
      descriptionAr: rewardForm.descriptionAr.trim() || null,
      pointsCost: rewardForm.pointsCost,
      stockQuantity:
        rewardForm.stockQuantity === ""
          ? null
          : Number(rewardForm.stockQuantity),
      sortOrder: rewardForm.sortOrder,
    };
    if (rewardEditor?.mode === "edit" && rewardEditor.id) {
      updateRewardMut.mutate({ id: rewardEditor.id, ...payload });
      return;
    }
    createRewardMut.mutate({ ...payload, isActive: false });
  };

  const submitRedemptionAction = () => {
    if (!redemptionAction) return;
    if (redemptionAction.action === "reject") {
      reviewRewardMut.mutate({
        id: redemptionAction.request.id,
        decision: "rejected",
        adminNote: redemptionNote.trim(),
      });
      return;
    }
    fulfillRewardMut.mutate({
      id: redemptionAction.request.id,
      adminNote: redemptionNote.trim() || null,
    });
  };

  const adjustmentAmount = Number(adjustmentForm.amount);
  const adjustmentPending = awardMut.isPending || deductMut.isPending;
  const adjustmentValid = Boolean(
    adjustment?.student &&
    Number.isInteger(adjustmentAmount) &&
    adjustmentAmount > 0 &&
    adjustmentAmount <= 100_000 &&
    adjustmentForm.reasonEn.trim() &&
    adjustmentForm.reasonAr.trim() &&
    (adjustment.mode === "award" ||
      adjustmentAmount <= adjustment.student.pointsBalance)
  );
  const rewardEditorPending =
    createRewardMut.isPending || updateRewardMut.isPending;
  const rewardEditorValid = Boolean(
    rewardForm.titleEn.trim() &&
    rewardForm.titleAr.trim() &&
    Number.isInteger(rewardForm.pointsCost) &&
    rewardForm.pointsCost > 0 &&
    (rewardForm.stockQuantity === "" ||
      (Number.isInteger(Number(rewardForm.stockQuantity)) &&
        Number(rewardForm.stockQuantity) >= 0)) &&
    Number.isInteger(rewardForm.sortOrder) &&
    rewardForm.sortOrder >= 0
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "leaderboard",
      label: isRtl ? "المتصدرين" : "Leaderboard",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      key: "rules",
      label: isRtl ? "قواعد النقاط" : "Points Rules",
      icon: <Settings2 className="w-4 h-4" />,
    },
    {
      key: "referrals",
      label: isRtl ? "الإحالات" : "Referrals",
      icon: <Users className="w-4 h-4" />,
    },
    {
      key: "rewards",
      label: isRtl ? "المكافآت" : "Rewards",
      icon: <Gift className="w-4 h-4" />,
    },
    {
      key: "preview",
      label: isRtl ? "معاينة الطالب" : "Student Preview",
      icon: <Eye className="w-4 h-4" />,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            {isRtl ? "نظام نقاط الولاء" : "Loyalty Points System"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {tab !== "preview" && (
              <Button variant="outline" onClick={() => setTab("preview")}>
                <Eye className="w-4 h-4 me-2" />
                {isRtl ? "معاينة تجربة الطالب" : "Preview student experience"}
              </Button>
            )}
            {tab === "leaderboard" && (
              <Button onClick={() => openAdjustment("award")}>
                <Plus className="w-4 h-4 me-2" />
                {isRtl ? "منح نقاط" : "Award Points"}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-w-36 flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow-sm text-amber-700" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard Tab */}
        {tab === "leaderboard" && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              {isRtl ? "لوحة المتصدرين" : "Points Leaderboard"}
            </h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : !leaderboard?.length ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
                <Trophy className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-800">
                  {isRtl ? "لا توجد أرصدة نقاط بعد" : "No point balances yet"}
                </p>
                <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">
                  {isRtl
                    ? "ستظهر حسابات الطلاب هنا بعد أول نشاط يمنح نقاطاً. يمكنك عرض تجربة المحفظة الآن باستخدام المعاينة."
                    : "Student accounts will appear after the first point-earning activity. You can demonstrate the wallet now with the preview."}
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setTab("preview")}
                >
                  <Eye className="h-4 w-4" />
                  {isRtl ? "فتح معاينة الطالب" : "Open student preview"}
                </Button>
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-start p-3">#</th>
                      <th className="text-start p-3">
                        {isRtl ? "المستخدم" : "User"}
                      </th>
                      <th className="text-start p-3">
                        {isRtl ? "البريد" : "Email"}
                      </th>
                      <th className="text-center p-3">
                        {isRtl ? "النقاط" : "Points"}
                      </th>
                      <th className="text-center p-3">
                        {isRtl ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((user: any, i: number) => (
                      <tr
                        key={user.id}
                        className="border-t hover:bg-gray-50/50"
                      >
                        <td className="p-3">
                          {i < 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-400" : "bg-amber-700"}`}
                            >
                              {i + 1}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {i + 1}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{user.name || "-"}</td>
                        <td className="p-3 text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="default"
                            className="bg-amber-100 text-amber-700"
                          >
                            {user.pointsBalance ?? 0}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 h-7 px-2"
                            onClick={() => openAdjustment("deduct", user)}
                          >
                            <Minus className="w-3 h-3 me-1" />{" "}
                            {isRtl ? "خصم" : "Deduct"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rules Tab */}
        {tab === "rules" && (
          <RulesTab
            rules={rules}
            isLoading={rulesLoading}
            isRtl={isRtl}
            onUpdate={(id, data) => updateRuleMut.mutate({ id, ...data })}
            updating={updateRuleMut.isPending}
          />
        )}

        {/* Referrals Tab */}
        {tab === "referrals" && (
          <ReferralsTab
            stats={referralStats}
            isLoading={refStatsLoading}
            isRtl={isRtl}
          />
        )}

        {/* Rewards Tab */}
        {tab === "rewards" && (
          <RewardsTab
            enabled={rewardsEnabled}
            items={rewardItems}
            redemptions={rewardRedemptions}
            itemsLoading={rewardItemsLoading}
            redemptionsLoading={rewardRedemptionsLoading}
            isRtl={isRtl}
            updating={
              updateRewardMut.isPending ||
              reviewRewardMut.isPending ||
              fulfillRewardMut.isPending
            }
            onOpenFeatureCenter={() => setLocation("/admin/features")}
            onCreate={() => openRewardEditor()}
            onEdit={openRewardEditor}
            onToggle={setVisibilityItem}
            onApprove={id =>
              reviewRewardMut.mutate({ id, decision: "approved" })
            }
            onReject={request => {
              setRedemptionNote("");
              setRedemptionAction({ action: "reject", request });
            }}
            onFulfill={request => {
              setRedemptionNote("");
              setRedemptionAction({ action: "fulfill", request });
            }}
          />
        )}

        {tab === "preview" && (
          <PointsStudentPreview
            isRtl={isRtl}
            rewardsEnabled={rewardsEnabled}
            focusOnMount={directStudentPreview}
          />
        )}
      </div>

      <PointAdjustmentDialog
        isRtl={isRtl}
        state={adjustment}
        search={studentSearch}
        setSearch={setStudentSearch}
        searchResults={studentSearchQuery.data ?? []}
        searchLoading={studentSearchQuery.isLoading}
        searchError={studentSearchQuery.isError}
        retrySearch={() => studentSearchQuery.refetch()}
        onSelectStudent={student =>
          setAdjustment(current =>
            current ? { ...current, student } : current
          )
        }
        onChangeStudent={() =>
          setAdjustment(current =>
            current ? { ...current, student: null } : current
          )
        }
        form={adjustmentForm}
        setForm={setAdjustmentForm}
        valid={adjustmentValid}
        pending={adjustmentPending}
        onCancel={closeAdjustment}
        onConfirm={submitAdjustment}
      />

      <RewardEditorDialog
        isRtl={isRtl}
        state={rewardEditor}
        form={rewardForm}
        setForm={setRewardForm}
        valid={rewardEditorValid}
        pending={rewardEditorPending}
        onCancel={() => {
          if (!rewardEditorPending) setRewardEditor(null);
        }}
        onConfirm={submitRewardEditor}
      />

      <RewardVisibilityDialog
        isRtl={isRtl}
        item={visibilityItem}
        rewardsEnabled={rewardsEnabled}
        pending={updateRewardMut.isPending}
        onCancel={() => {
          if (!updateRewardMut.isPending) setVisibilityItem(null);
        }}
        onConfirm={() =>
          visibilityItem &&
          updateRewardMut.mutate({
            id: visibilityItem.id,
            isActive: !visibilityItem.isActive,
          })
        }
        onOpenFeatureCenter={() => {
          setVisibilityItem(null);
          setLocation("/admin/features");
        }}
      />

      <RedemptionActionDialog
        isRtl={isRtl}
        state={redemptionAction}
        note={redemptionNote}
        setNote={setRedemptionNote}
        pending={reviewRewardMut.isPending || fulfillRewardMut.isPending}
        onCancel={closeRedemptionAction}
        onConfirm={submitRedemptionAction}
      />
    </DashboardLayout>
  );
}

function RulesTab({
  rules,
  isLoading,
  isRtl,
  onUpdate,
  updating,
}: {
  rules: any[] | undefined;
  isLoading: boolean;
  isRtl: boolean;
  onUpdate: (
    id: number,
    data: { points?: number; isActive?: boolean; maxPerDay?: number | null }
  ) => void;
  updating: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState(0);
  const [editMaxPerDay, setEditMaxPerDay] = useState<string>("");

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  if (!rules?.length)
    return (
      <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
        <Settings2 className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 font-semibold text-slate-800">
          {isRtl ? "لا توجد قواعد نقاط بعد" : "No point rules configured yet"}
        </p>
        <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">
          {isRtl
            ? "أضف قواعد واضحة للأنشطة قبل بدء التجربة حتى يعرف الفريق متى وكيف تُمنح النقاط."
            : "Add clear earning rules before the pilot so the team knows when and how points are awarded."}
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {isRtl
          ? "تحكم في عدد النقاط الممنوحة لكل نشاط"
          : "Control how many points are awarded for each activity"}
      </p>
      <div className="grid gap-3">
        {rules.map((rule: any) => {
          const isEditing = editingId === rule.id;
          return (
            <div
              key={rule.id}
              className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">
                    {isRtl ? rule.nameAr : rule.nameEn}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {rule.ruleKey}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? rule.descriptionAr : rule.descriptionEn}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isEditing ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">
                        {isRtl ? "النقاط" : "Points"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="w-20 border rounded px-2 py-1 text-sm text-center"
                        value={editPoints}
                        onChange={e =>
                          setEditPoints(parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">
                        {isRtl ? "حد يومي" : "Daily Cap"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="w-20 border rounded px-2 py-1 text-sm text-center"
                        placeholder="∞"
                        value={editMaxPerDay}
                        onChange={e => setEditMaxPerDay(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={updating}
                      onClick={() => {
                        onUpdate(rule.id, {
                          points: editPoints,
                          maxPerDay: editMaxPerDay
                            ? parseInt(editMaxPerDay)
                            : null,
                        });
                        setEditingId(null);
                      }}
                    >
                      <Save className="w-3 h-3 me-1" /> {isRtl ? "حفظ" : "Save"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge className="bg-amber-100 text-amber-700 text-sm">
                      +{rule.points}
                    </Badge>
                    {rule.maxPerDay && (
                      <span className="text-xs text-muted-foreground">
                        {isRtl
                          ? `حد: ${rule.maxPerDay}/يوم`
                          : `Cap: ${rule.maxPerDay}/day`}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        onUpdate(rule.id, { isActive: !rule.isActive })
                      }
                      className={`transition-colors ${rule.isActive ? "text-green-500" : "text-gray-400"}`}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(rule.id);
                        setEditPoints(rule.points);
                        setEditMaxPerDay(rule.maxPerDay?.toString() || "");
                      }}
                    >
                      {isRtl ? "تعديل" : "Edit"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferralsTab({
  stats,
  isLoading,
  isRtl,
}: {
  stats: any;
  isLoading: boolean;
  isRtl: boolean;
}) {
  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  if (!stats)
    return (
      <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 font-semibold text-slate-800">
          {isRtl ? "لا توجد إحالات مسجلة بعد" : "No referrals recorded yet"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {isRtl
            ? "ستظهر هنا الإحالات المفعّلة والنقاط الممنوحة لأصحابها."
            : "Activated referrals and the points they generated will appear here."}
        </p>
      </div>
    );

  const statCards = [
    {
      label: isRtl ? "إجمالي الإحالات" : "Total Referrals",
      value: stats.total ?? 0,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: isRtl ? "إحالات مفعّلة" : "Activated",
      value: stats.activated ?? 0,
      color: "bg-green-100 text-green-700",
    },
    {
      label: isRtl ? "نقاط ممنوحة" : "Points Awarded",
      value: stats.totalPointsAwarded ?? 0,
      color: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border rounded-xl p-5 text-center">
            <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
            <Badge className={`text-lg px-3 py-1 ${s.color}`}>{s.value}</Badge>
          </div>
        ))}
      </div>

      {/* Top Referrers */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          {isRtl ? "أفضل المُحيلين" : "Top Referrers"}
        </h3>
        {!stats.topReferrers?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            {isRtl ? "لا يوجد مُحيلين بعد" : "No referrers yet"}
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-start p-3">#</th>
                  <th className="text-start p-3">
                    {isRtl ? "المستخدم" : "User"}
                  </th>
                  <th className="text-center p-3">
                    {isRtl ? "عدد الإحالات" : "Referrals"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topReferrers.map((r: any, i: number) => (
                  <tr
                    key={r.referrerId}
                    className="border-t hover:bg-gray-50/50"
                  >
                    <td className="p-3">
                      {i < 3 ? (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-400" : "bg-amber-700"}`}
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{i + 1}</span>
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {r.name || r.email || `#${r.referrerId}`}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className="bg-amber-100 text-amber-700">
                        {r.count}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RewardsTab({
  enabled,
  items,
  redemptions,
  itemsLoading,
  redemptionsLoading,
  isRtl,
  updating,
  onOpenFeatureCenter,
  onCreate,
  onEdit,
  onToggle,
  onApprove,
  onReject,
  onFulfill,
}: {
  enabled: boolean;
  items: any[] | undefined;
  redemptions: any[] | undefined;
  itemsLoading: boolean;
  redemptionsLoading: boolean;
  isRtl: boolean;
  updating: boolean;
  onOpenFeatureCenter: () => void;
  onCreate: () => void;
  onEdit: (item: any) => void;
  onToggle: (item: any) => void;
  onApprove: (id: number) => void;
  onReject: (request: any) => void;
  onFulfill: (request: any) => void;
}) {
  return (
    <div className="space-y-6">
      {!enabled && (
        <AdminFeatureSetupCard
          isRtl={isRtl}
          title={
            isRtl
              ? "جهّز كتالوج المكافآت بأمان قبل الإطلاق"
              : "Prepare the rewards catalog safely before launch"
          }
          description={
            isRtl
              ? "يمكنك إنشاء المسودات وتعديل الأسعار والمخزون الآن. ستبقى جميع المكافآت وطلبات الاستبدال مخفية عن الطلاب حتى تفعيل الكتالوج من مركز الميزات."
              : "You can create drafts and edit costs and stock now. Rewards and student redemptions remain hidden until you launch the catalog from Feature Center."
          }
          action={
            <Button variant="outline" onClick={onOpenFeatureCenter}>
              <ExternalLink className="h-4 w-4" />
              {isRtl ? "فتح مركز الميزات" : "Open Feature Center"}
            </Button>
          }
          items={[
            {
              label: isRtl
                ? "أنشئ مسودات المكافآت وراجع محتواها"
                : "Create and review reward drafts",
              complete: Boolean(items?.length),
            },
            {
              label: isRtl
                ? "تحقق من تكلفة النقاط والمخزون"
                : "Verify points cost and stock",
            },
            {
              label: isRtl
                ? "فعّل الكتالوج فقط عندما يصبح جاهزاً"
                : "Launch only when the catalog is ready",
            },
          ]}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Gift className="h-5 w-5 text-amber-500" />
              {isRtl
                ? enabled
                  ? "كتالوج المكافآت"
                  : "مسودات كتالوج المكافآت"
                : enabled
                  ? "Reward catalog"
                  : "Reward catalog drafts"}
            </h3>
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              {isRtl ? "إضافة مسودة" : "Add reward draft"}
            </Button>
          </div>
          {itemsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !items?.length ? (
            <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
              <Gift className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 font-semibold text-slate-700">
                {isRtl ? "لا توجد مكافآت بعد" : "No rewards yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isRtl
                  ? "أنشئ أول مكافأة كمسودة، راجع تكلفتها ومخزونها، ثم فعّلها للطلاب."
                  : "Create the first reward as a draft, review its cost and stock, then make it active for students."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">
                        {isRtl ? item.titleAr : item.titleEn}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isRtl ? item.descriptionAr : item.descriptionEn}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">
                      {item.pointsCost} pts
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {isRtl ? "المخزون" : "Stock"}:{" "}
                      {item.stockQuantity ??
                        (isRtl ? "غير محدود" : "Unlimited")}{" "}
                      · {isRtl ? "الترتيب" : "Order"}: {item.sortOrder ?? 0}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />{" "}
                        {isRtl ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating || (!enabled && !item.isActive)}
                        onClick={() => onToggle(item)}
                      >
                        {item.isActive ? (
                          <ToggleRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        )}
                        {item.isActive
                          ? enabled
                            ? isRtl
                              ? "منشورة"
                              : "Published"
                            : isRtl
                              ? "جاهزة عند الإطلاق"
                              : "Ready on launch"
                          : enabled
                            ? isRtl
                              ? "نشر"
                              : "Publish"
                            : isRtl
                              ? "مسودة"
                              : "Draft"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            {isRtl ? "طلبات الاستبدال" : "Redemption requests"}
          </h3>
          {!enabled ? (
            <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
              <PackageCheck className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 font-semibold text-slate-700">
                {isRtl
                  ? "الاستبدال غير متاح للطلاب"
                  : "Student redemption is off"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isRtl
                  ? "لن تُنشأ طلبات جديدة قبل إطلاق الكتالوج. استخدم المعاينة لشرح المسار دون خصم نقاط حقيقية."
                  : "No new requests can be created before launch. Use the preview to explain the flow without deducting real points."}
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={onOpenFeatureCenter}
              >
                {isRtl ? "مراجعة جاهزية الإطلاق" : "Review launch readiness"}
              </Button>
            </div>
          ) : redemptionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !redemptions?.length ? (
            <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
              <PackageCheck className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 font-semibold text-slate-700">
                {isRtl
                  ? "لا توجد طلبات استبدال بعد"
                  : "No redemption requests yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isRtl
                  ? "ستظهر الطلبات هنا بالترتيب: بانتظار المراجعة، معتمدة، ثم منفذة أو مرفوضة مع استرجاع النقاط."
                  : "Requests will appear here as pending, approved, then fulfilled—or rejected with an automatic points refund."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map(request => (
                <div
                  key={request.id}
                  className="rounded-xl border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">
                        {isRtl ? request.titleAr : request.titleEn}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.studentEmail}
                      </p>
                    </div>
                    <Badge className={rewardStatusClass(request.status)}>
                      {rewardStatusLabel(request.status, isRtl)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {request.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={updating}
                          onClick={() => onApprove(request.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />{" "}
                          {isRtl ? "اعتماد" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={() => onReject(request)}
                        >
                          <XCircle className="h-4 w-4" />{" "}
                          {isRtl ? "رفض واسترجاع" : "Reject & refund"}
                        </Button>
                      </>
                    )}
                    {request.status === "approved" && (
                      <Button
                        size="sm"
                        disabled={updating}
                        onClick={() => onFulfill(request)}
                      >
                        <PackageCheck className="h-4 w-4" />{" "}
                        {isRtl ? "تم التنفيذ" : "Mark fulfilled"}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {request.pointsCost} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!enabled && (
        <PointsStudentPreview isRtl={isRtl} rewardsEnabled={false} compact />
      )}
    </div>
  );
}

function PointAdjustmentDialog({
  isRtl,
  state,
  search,
  setSearch,
  searchResults,
  searchLoading,
  searchError,
  retrySearch,
  onSelectStudent,
  onChangeStudent,
  form,
  setForm,
  valid,
  pending,
  onCancel,
  onConfirm,
}: {
  isRtl: boolean;
  state: { mode: "award" | "deduct"; student: LoyaltyStudent | null } | null;
  search: string;
  setSearch: (value: string) => void;
  searchResults: LoyaltyStudent[];
  searchLoading: boolean;
  searchError: boolean;
  retrySearch: () => void;
  onSelectStudent: (student: LoyaltyStudent) => void;
  onChangeStudent: () => void;
  form: { amount: string; reasonEn: string; reasonAr: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ amount: string; reasonEn: string; reasonAr: string }>
  >;
  valid: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeduct = state?.mode === "deduct";
  const amount = Number(form.amount) || 0;
  const balance = state?.student?.pointsBalance ?? 0;
  const resultingBalance = isDeduct ? balance - amount : balance + amount;
  const hasSearch = search.trim().length >= 2;

  return (
    <Dialog
      open={Boolean(state)}
      onOpenChange={open => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        dir={isRtl ? "rtl" : "ltr"}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {isDeduct
              ? isRtl
                ? "خصم نقاط من رصيد طالب"
                : "Deduct points from a student"
              : isRtl
                ? "منح نقاط لطالب"
                : "Award points to a student"}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? "ابحث بالاسم أو البريد، راجع الرصيد، ثم أكد المبلغ والسبب الذي سيظهر في سجل النقاط."
              : "Search by name or email, review the balance, then confirm the amount and bilingual reason recorded in points history."}
          </DialogDescription>
        </DialogHeader>

        {!state?.student ? (
          <div className="space-y-3">
            <Label htmlFor="points-student-search">
              {isRtl ? "الطالب" : "Student"}
            </Label>
            <div className="relative">
              <Search className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="points-student-search"
                autoFocus
                className="ps-9"
                value={search}
                maxLength={120}
                placeholder={
                  isRtl
                    ? "اكتب حرفين على الأقل من الاسم أو البريد"
                    : "Enter at least 2 characters from name or email"
                }
                onChange={event => setSearch(event.target.value)}
              />
            </div>
            {!hasSearch ? (
              <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
                {isRtl
                  ? "تظهر نتائج محدودة وآمنة بعد كتابة حرفين."
                  : "A limited, safe result list appears after two characters."}
              </p>
            ) : searchLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              </div>
            ) : searchError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p>
                  {isRtl
                    ? "تعذر البحث عن الطلاب."
                    : "Student search could not be loaded."}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={retrySearch}
                >
                  {isRtl ? "إعادة المحاولة" : "Try again"}
                </Button>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
                {isRtl
                  ? "لا توجد حسابات طلاب مطابقة."
                  : "No matching student accounts."}
              </p>
            ) : (
              <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">
                {searchResults.map(student => (
                  <button
                    key={student.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-start hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    onClick={() => onSelectStudent(student)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-950">
                        {student.name || student.email}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {student.email}
                      </span>
                    </span>
                    <Badge className="shrink-0 bg-amber-100 text-amber-800">
                      {student.pointsBalance} {isRtl ? "نقطة" : "pts"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">
                    {state.student.name || state.student.email}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {state.student.email}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    {isRtl ? "الرصيد الحالي" : "Current balance"}: {balance}{" "}
                    {isRtl ? "نقطة" : "points"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onChangeStudent}
              >
                {isRtl ? "تغيير الطالب" : "Change student"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="points-adjustment-amount">
                  {isRtl ? "عدد النقاط" : "Points amount"}
                </Label>
                <Input
                  id="points-adjustment-amount"
                  type="number"
                  min={1}
                  max={100000}
                  value={form.amount}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
                {isDeduct && amount > balance && (
                  <p className="text-xs font-medium text-red-600">
                    {isRtl
                      ? "لا يمكن أن يتجاوز الخصم الرصيد الحالي."
                      : "The deduction cannot exceed the current balance."}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="points-reason-en">
                  {isRtl ? "السبب بالإنجليزية" : "Reason in English"}
                </Label>
                <Textarea
                  id="points-reason-en"
                  maxLength={200}
                  value={form.reasonEn}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      reasonEn: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points-reason-ar">
                  {isRtl ? "السبب بالعربية" : "Reason in Arabic"}
                </Label>
                <Textarea
                  id="points-reason-ar"
                  dir="rtl"
                  maxLength={200}
                  value={form.reasonAr}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      reasonAr: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {amount > 0 && (
              <div
                className={`rounded-xl border p-4 ${isDeduct ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
              >
                <p className="font-semibold">
                  {isDeduct
                    ? isRtl
                      ? "تأكيد أثر الخصم"
                      : "Confirm deduction impact"
                    : isRtl
                      ? "تأكيد أثر المنح"
                      : "Confirm award impact"}
                </p>
                <p className="mt-1 text-sm">
                  {balance} → {resultingBalance} {isRtl ? "نقطة" : "points"}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          {state?.student && (
            <Button
              variant={isDeduct ? "destructive" : "default"}
              disabled={!valid || pending}
              onClick={onConfirm}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeduct
                ? isRtl
                  ? "تأكيد الخصم"
                  : "Confirm deduction"
                : isRtl
                  ? "تأكيد المنح"
                  : "Confirm award"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RewardEditorDialog({
  isRtl,
  state,
  form,
  setForm,
  valid,
  pending,
  onCancel,
  onConfirm,
}: {
  isRtl: boolean;
  state: { mode: "create" | "edit"; id?: number } | null;
  form: RewardDraftForm;
  setForm: React.Dispatch<React.SetStateAction<RewardDraftForm>>;
  valid: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const editing = state?.mode === "edit";
  return (
    <Dialog
      open={Boolean(state)}
      onOpenChange={open => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        dir={isRtl ? "rtl" : "ltr"}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {editing
              ? isRtl
                ? "تعديل المكافأة"
                : "Edit reward"
              : isRtl
                ? "إضافة مسودة مكافأة"
                : "Add reward draft"}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? "احفظ المحتوى والتكلفة والمخزون كمسودة. يتم النشر أو الإيقاف بخطوة تأكيد منفصلة."
              : "Save content, cost, and stock as a draft. Publishing and unpublishing always use a separate confirmation."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <RewardInput
            label={isRtl ? "العنوان الإنجليزي" : "English title"}
            value={form.titleEn}
            onChange={value =>
              setForm(current => ({ ...current, titleEn: value }))
            }
          />
          <RewardInput
            label={isRtl ? "العنوان العربي" : "Arabic title"}
            value={form.titleAr}
            onChange={value =>
              setForm(current => ({ ...current, titleAr: value }))
            }
            dir="rtl"
          />
          <div className="space-y-2">
            <Label htmlFor="reward-description-en">
              {isRtl ? "الوصف الإنجليزي" : "English description"}
            </Label>
            <Textarea
              id="reward-description-en"
              maxLength={2000}
              value={form.descriptionEn}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  descriptionEn: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward-description-ar">
              {isRtl ? "الوصف العربي" : "Arabic description"}
            </Label>
            <Textarea
              id="reward-description-ar"
              dir="rtl"
              maxLength={2000}
              value={form.descriptionAr}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  descriptionAr: event.target.value,
                }))
              }
            />
          </div>
          <RewardInput
            label={isRtl ? "تكلفة النقاط" : "Points cost"}
            type="number"
            value={String(form.pointsCost || "")}
            onChange={value =>
              setForm(current => ({
                ...current,
                pointsCost: Number(value) || 0,
              }))
            }
          />
          <RewardInput
            label={
              isRtl ? "المخزون، فارغ = غير محدود" : "Stock, blank = unlimited"
            }
            type="number"
            value={form.stockQuantity}
            onChange={value =>
              setForm(current => ({ ...current, stockQuantity: value }))
            }
          />
          <RewardInput
            label={isRtl ? "ترتيب العرض" : "Display order"}
            type="number"
            value={String(form.sortOrder)}
            onChange={value =>
              setForm(current => ({
                ...current,
                sortOrder: Number(value) || 0,
              }))
            }
          />
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          {editing
            ? isRtl
              ? "حفظ التعديلات لا يغيّر حالة النشر الحالية."
              : "Saving these edits does not change the current publication status."
            : isRtl
              ? "سيتم إنشاء المكافأة كمسودة غير مرئية للطلاب."
              : "This reward will be created as a student-hidden draft."}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button disabled={!valid || pending} onClick={onConfirm}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing
              ? isRtl
                ? "حفظ التعديلات"
                : "Save changes"
              : isRtl
                ? "حفظ المسودة"
                : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RewardVisibilityDialog({
  isRtl,
  item,
  rewardsEnabled,
  pending,
  onCancel,
  onConfirm,
  onOpenFeatureCenter,
}: {
  isRtl: boolean;
  item: any | null;
  rewardsEnabled: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenFeatureCenter: () => void;
}) {
  const publishing = item ? !item.isActive : false;
  const blocked = publishing && !rewardsEnabled;
  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={open => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent dir={isRtl ? "rtl" : "ltr"} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {publishing
              ? isRtl
                ? "نشر المكافأة للطلاب؟"
                : "Publish this reward to students?"
              : isRtl
                ? "إيقاف نشر المكافأة؟"
                : "Unpublish this reward?"}
          </DialogTitle>
          <DialogDescription>
            {item ? (isRtl ? item.titleAr : item.titleEn) : ""}
          </DialogDescription>
        </DialogHeader>
        <div
          className={`rounded-xl border p-4 ${publishing ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <p className="font-semibold">
            {publishing
              ? isRtl
                ? "ستظهر في كتالوج الطلاب فوراً."
                : "It will appear in the student catalog immediately."
              : isRtl
                ? "ستختفي من الكتالوج، ولن تتأثر الطلبات الموجودة."
                : "It will leave the catalog; existing requests are not changed."}
          </p>
          {item && (
            <p className="mt-2 text-sm">
              {item.pointsCost} {isRtl ? "نقطة" : "points"} ·{" "}
              {isRtl ? "المخزون" : "Stock"}:{" "}
              {item.stockQuantity ?? (isRtl ? "غير محدود" : "Unlimited")}
            </p>
          )}
        </div>
        {blocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {isRtl
              ? "الكتالوج ما زال في وضع ما قبل الإطلاق. فعّله من مركز الميزات قبل نشر أي مكافأة."
              : "The catalog is still in prelaunch mode. Enable it from Feature Center before publishing any reward."}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          {blocked ? (
            <Button onClick={onOpenFeatureCenter}>
              <ExternalLink className="h-4 w-4" />
              {isRtl ? "فتح مركز الميزات" : "Open Feature Center"}
            </Button>
          ) : (
            <Button
              variant={publishing ? "default" : "destructive"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {publishing
                ? isRtl
                  ? "تأكيد النشر"
                  : "Confirm publish"
                : isRtl
                  ? "تأكيد إيقاف النشر"
                  : "Confirm unpublish"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionActionDialog({
  isRtl,
  state,
  note,
  setNote,
  pending,
  onCancel,
  onConfirm,
}: {
  isRtl: boolean;
  state: { action: "reject" | "fulfill"; request: any } | null;
  note: string;
  setNote: (value: string) => void;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rejecting = state?.action === "reject";
  const request = state?.request;
  return (
    <Dialog
      open={Boolean(state)}
      onOpenChange={open => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent dir={isRtl ? "rtl" : "ltr"} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {rejecting
              ? isRtl
                ? "رفض الطلب وإرجاع النقاط؟"
                : "Reject request and refund points?"
              : isRtl
                ? "تأكيد تنفيذ المكافأة؟"
                : "Confirm reward fulfillment?"}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? "راجع الطالب والمكافأة والأثر قبل حفظ القرار."
              : "Review the student, reward, and consequence before saving this decision."}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="space-y-3">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">
                {request.studentName || request.studentEmail}
              </p>
              <p className="text-xs text-slate-500">{request.studentEmail}</p>
              <p className="mt-3 text-sm font-medium text-slate-800">
                {isRtl ? request.titleAr : request.titleEn}
              </p>
              <Badge className="mt-2 bg-amber-100 text-amber-800">
                {request.pointsCost} {isRtl ? "نقطة" : "points"}
              </Badge>
            </div>
            <div
              className={`rounded-xl border p-4 text-sm leading-6 ${rejecting ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
            >
              {rejecting
                ? isRtl
                  ? "سيُرفض الطلب وتُعاد النقاط تلقائياً إلى محفظة الطالب. لا يمكن تنفيذ الطلب بعد ذلك."
                  : "The request will be rejected and its points automatically returned to the student. It cannot then be fulfilled."
                : isRtl
                  ? "سيُسجل الطلب كمنفذ. هذا الإجراء متاح فقط بعد اعتماده."
                  : "The request will be recorded as fulfilled. This is available only after approval."}
            </div>
            <div className="space-y-2">
              <Label htmlFor="redemption-action-note">
                {rejecting
                  ? isRtl
                    ? "سبب الرفض (مطلوب)"
                    : "Rejection reason (required)"
                  : isRtl
                    ? "ملاحظة التنفيذ (اختيارية)"
                    : "Fulfillment note (optional)"}
              </Label>
              <Textarea
                id="redemption-action-note"
                autoFocus
                maxLength={2000}
                value={note}
                onChange={event => setNote(event.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            variant={rejecting ? "destructive" : "default"}
            disabled={pending || (rejecting && note.trim().length === 0)}
            onClick={onConfirm}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {rejecting
              ? isRtl
                ? "تأكيد الرفض والاسترجاع"
                : "Confirm rejection & refund"
              : isRtl
                ? "تأكيد التنفيذ"
                : "Confirm fulfillment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PointsStudentPreview({
  isRtl,
  rewardsEnabled,
  compact = false,
  focusOnMount = false,
}: {
  isRtl: boolean;
  rewardsEnabled: boolean;
  compact?: boolean;
  focusOnMount?: boolean;
}) {
  const copy = isRtl
    ? {
        audience: "طالب تجريبي — سارة أحمد",
        title: "محفظة النقاط وكتالوج المكافآت كما يراهما الطالب",
        description:
          "استخدم هذه الشاشة لشرح الرصيد، طرق كسب النقاط، وخطوات الاستبدال من حساب الإدارة.",
        balance: "الرصيد المتاح",
        earned: "نقاط مكتسبة هذا الشهر",
        activity: "آخر نشاط",
        lesson: "إكمال درس: أساسيات الذكاء الاصطناعي",
        referral: "تفعيل إحالة صديق",
        rewards: "مكافآت متاحة",
        voucher: "قسيمة جلسة إرشاد فردية",
        template: "حزمة قوالب مهنية",
        redeem: "استبدال",
        unavailable: "المكافآت مخفية حالياً عن الطلاب",
        unavailableBody:
          "يعرض المدير نموذجاً توضيحياً فقط. لن يظهر الكتالوج الحقيقي ولن تُخصم أي نقطة قبل الإطلاق.",
        live: "الكتالوج متاح للطلاب",
        flow: "مسار طلب المكافأة",
        available: "متاحة",
        requested: "تم الطلب",
        approved: "معتمدة",
        fulfilled: "تم التنفيذ",
        refund: "عند رفض الطلب تُعاد النقاط تلقائياً إلى المحفظة.",
      }
    : {
        audience: "Sample student — Sara Ahmad",
        title: "Student points wallet and rewards catalog",
        description:
          "Use this screen to explain the balance, earning activity, and redemption journey directly from the admin account.",
        balance: "Available balance",
        earned: "Earned this month",
        activity: "Recent activity",
        lesson: "Completed lesson: AI fundamentals",
        referral: "Friend referral activated",
        rewards: "Available rewards",
        voucher: "One-to-one mentoring session",
        template: "Career template bundle",
        redeem: "Redeem",
        unavailable: "Rewards are currently hidden from students",
        unavailableBody:
          "The admin is seeing a demonstration only. The real catalog stays hidden and no points can be deducted before launch.",
        live: "Catalog available to students",
        flow: "Reward request journey",
        available: "Available",
        requested: "Requested",
        approved: "Approved",
        fulfilled: "Fulfilled",
        refund:
          "If a request is rejected, its points are automatically returned to the wallet.",
      };

  const rewards = [
    {
      title: copy.voucher,
      cost: 900,
      stock: isRtl ? "3 متاحة" : "3 available",
    },
    {
      title: copy.template,
      cost: 450,
      stock: isRtl ? "غير محدود" : "Unlimited",
    },
  ];

  return (
    <SafeAdminPreview
      isRtl={isRtl}
      audience={copy.audience}
      title={copy.title}
      description={copy.description}
      anchorId="points-student-preview"
      focusOnMount={focusOnMount}
    >
      <div
        className={`grid gap-5 ${compact ? "" : "xl:grid-cols-[0.9fr_1.1fr]"}`}
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/80">{copy.balance}</p>
                <p className="mt-1 text-4xl font-black">1,240</p>
              </div>
              <WalletCards className="h-8 w-8 text-white/80" />
            </div>
            <div className="mt-5 rounded-xl bg-white/15 px-3 py-2 text-sm">
              +320 {copy.earned}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 font-semibold text-slate-950">
              <Sparkles className="h-4 w-4 text-amber-500" /> {copy.activity}
            </h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">{copy.lesson}</span>
                <Badge className="bg-emerald-50 text-emerald-700">+40</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">{copy.referral}</span>
                <Badge className="bg-emerald-50 text-emerald-700">+200</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className={`rounded-xl border p-4 ${rewardsEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
          >
            <div className="flex items-start gap-3">
              {rewardsEnabled ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <Gift className="mt-0.5 h-5 w-5 text-amber-600" />
              )}
              <div>
                <p
                  className={`font-semibold ${rewardsEnabled ? "text-emerald-950" : "text-amber-950"}`}
                >
                  {rewardsEnabled ? copy.live : copy.unavailable}
                </p>
                {!rewardsEnabled && (
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {copy.unavailableBody}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
              <ShoppingBag className="h-5 w-5 text-amber-500" />
              {copy.rewards}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {rewards.map(reward => (
                <div
                  key={reward.title}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Gift className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-slate-950">{reward.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{reward.stock}</p>
                  <Button className="mt-4 w-full" size="sm" disabled>
                    {reward.cost} pts · {copy.redeem}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">
              {copy.flow}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              {[
                copy.available,
                copy.requested,
                copy.approved,
                copy.fulfilled,
              ].map((step, index, all) => (
                <div key={step} className="contents">
                  <span className="rounded-full border bg-white px-3 py-1.5">
                    {step}
                  </span>
                  {index < all.length - 1 && (
                    <ArrowRight
                      className={`h-3.5 w-3.5 text-slate-400 ${isRtl ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {copy.refund}
            </p>
          </div>
        </div>
      </div>
    </SafeAdminPreview>
  );
}

function RewardInput({
  label,
  value,
  onChange,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={event => onChange(event.target.value)}
        className="rounded border px-3 py-2 text-sm"
      />
    </label>
  );
}

function rewardStatusLabel(status: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["Pending", "بانتظار المراجعة"],
    approved: ["Approved", "معتمد"],
    rejected: ["Rejected/refunded", "مرفوض/مسترجع"],
    fulfilled: ["Fulfilled", "منفذ"],
  };
  return labels[status]?.[isRtl ? 1 : 0] ?? status;
}

function rewardStatusClass(status: string) {
  if (status === "approved") return "bg-blue-100 text-blue-700";
  if (status === "fulfilled") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
