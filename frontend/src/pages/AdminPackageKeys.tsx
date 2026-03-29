import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Package,
  Layers,
  ArrowUpCircle,
  Trophy,
  TrendingUp,
  User,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Snowflake,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  useDataTable,
  DataTablePagination,
  SortableHeader,
  zebraRow,
} from "@/components/DataTable";

const keySortFns: Record<string, (a: any, b: any) => number> = {
  keyCode: (a, b) => (a.keyCode || "").localeCompare(b.keyCode || ""),
  package: (a, b) => (a.packageName || "").localeCompare(b.packageName || ""),
  email: (a, b) => (a.email || "").localeCompare(b.email || ""),
  status: (a, b) => {
    const rank = (k: any) => !k.isActive ? 0 : k.activatedAt ? 2 : 1;
    return rank(a) - rank(b);
  },
  price: (a, b) => (a.price || 0) - (b.price || 0),
  type: (a, b) => {
    const rank = (k: any) => k.isRenewal ? 2 : k.isUpgrade ? 1 : 0;
    return rank(a) - rank(b);
  },
  activated: (a, b) =>
    new Date(a.activatedAt || 0).getTime() - new Date(b.activatedAt || 0).getTime(),
  created: (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
};

export default function AdminPackageKeys() {
  const { t, language } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("0");
  const [entitlementDays, setEntitlementDays] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isUpgrade, setIsUpgrade] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [referredBy, setReferredBy] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [deactivateDialogKey, setDeactivateDialogKey] = useState<{ id: number; keyCode: string } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [freezeDialogUserId, setFreezeDialogUserId] = useState<number | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeDays, setFreezeDays] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'activated' | 'unused' | 'deactivated' | 'frozen'>('all');

  // Column visibility — smart defaults: show most important columns
  const allColumns = [
    { key: 'keyCode', en: 'Key Code', ar: 'المفتاح' },
    { key: 'package', en: 'Package', ar: 'الباقة' },
    { key: 'email', en: 'Email', ar: 'البريد' },
    { key: 'status', en: 'Status', ar: 'الحالة' },
    { key: 'price', en: 'Price', ar: 'السعر' },
    { key: 'duration', en: 'Duration / Expiry', ar: 'المدة / الانتهاء' },
    { key: 'activated', en: 'Activated', ar: 'تاريخ التفعيل' },
    { key: 'created', en: 'Created', ar: 'تاريخ الإنشاء' },
    { key: 'notes', en: 'Notes', ar: 'ملاحظات' },
  ] as const;
  const defaultVisibleCols = new Set(['keyCode', 'package', 'email', 'status', 'price']);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('adminKeys_visibleCols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(defaultVisibleCols);
  });
  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      localStorage.setItem('adminKeys_visibleCols', JSON.stringify([...next]));
      return next;
    });
  };
  const visibleColCount = visibleCols.size + 1; // +1 for actions column

  // Helper: package badge color classes
  const getPackageBadgeClass = (packageId: number) => {
    const pkg = packages.find((p: any) => p.id === packageId);
    if (pkg?.includesLexai) return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100';
  };

  // Data queries
  const keysQuery = trpc.packageKeys.list.useQuery();
  const statsQuery = trpc.packageKeys.stats.useQuery();
  const packagesQuery = trpc.packages.list.useQuery();
  const upgradeStatsQuery = trpc.packageKeys.upgradeStats.useQuery({ month: selectedMonth });

  // Mutations
  const generateKey = trpc.packageKeys.generateKey.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' ? `تم إنشاء المفتاح: ${data.keyCode}` : `Key generated: ${data.keyCode}`);
      keysQuery.refetch();
      statsQuery.refetch();
      setShowGenerateDialog(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateBulk = trpc.packageKeys.generateBulkKeys.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' ? `تم إنشاء ${data.count} مفتاح` : `${data.count} keys generated`);
      keysQuery.refetch();
      statsQuery.refetch();
      setShowBulkDialog(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateKey = trpc.packageKeys.deactivateKey.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إلغاء تفعيل المفتاح' : 'Key deactivated');
      keysQuery.refetch();
      statsQuery.refetch();
      setDeactivateDialogKey(null);
      setDeactivateReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const reactivateKey = trpc.packageKeys.reactivateKey.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إعادة تفعيل المفتاح' : 'Key reactivated');
      keysQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const freezeUser = trpc.packageKeys.freeze.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تجميد الاشتراكات' : 'Subscriptions frozen');
      setFreezeDialogUserId(null);
      setFreezeReason("");
      setFreezeDays("");
      keysQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unfreezeUser = trpc.packageKeys.unfreeze.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم استئناف الاشتراكات' : 'Subscriptions resumed');
      keysQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setSelectedPackage(null);
    setQuantity("1");
    setNotes("");
    setPrice("0");
    setEntitlementDays("");
    setExpiresAt("");
    setAssignEmail("");
    setIsUpgrade(false);
    setIsRenewal(false);
    setReferredBy("");
  };

  const handleGenerateKey = () => {
    if (!selectedPackage) {
      toast.error(language === 'ar' ? 'يرجى اختيار الباقة' : 'Please select a package');
      return;
    }
    generateKey.mutate({
      packageId: selectedPackage,
      email: assignEmail || undefined,
      notes: notes || undefined,
      price: parseInt(price) || undefined,
      entitlementDays: entitlementDays ? parseInt(entitlementDays, 10) : undefined,
      expiresAt: expiresAt || undefined,
      isUpgrade: isUpgrade || undefined,
      isRenewal: isRenewal || undefined,
      referredBy: referredBy.trim() || undefined,
    });
  };

  const handleGenerateBulk = () => {
    if (!selectedPackage) {
      toast.error(language === 'ar' ? 'يرجى اختيار الباقة' : 'Please select a package');
      return;
    }
    generateBulk.mutate({
      packageId: selectedPackage,
      quantity: parseInt(quantity) || 1,
      notes: notes || undefined,
      price: parseInt(price) || undefined,
      entitlementDays: entitlementDays ? parseInt(entitlementDays, 10) : undefined,
      expiresAt: expiresAt || undefined,
      isUpgrade: isUpgrade || undefined,
      isRenewal: isRenewal || undefined,
      referredBy: referredBy.trim() || undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!');
  };

  const exportCSV = () => {
    const keys = filteredKeys;
    if (!keys.length) return;
    const headers = ['Key Code', 'Package', 'Email', 'Status', 'Entitlement Days', 'Redeem By', 'Sub Expiry', 'Type', 'Upgrade', 'Referred By', 'Created', 'Activated', 'Notes'];
    const rows = keys.map(k => [
      k.keyCode,
      (k as any).packageName || '',
      k.email || '',
      k.activatedAt ? 'Activated' : k.isActive ? 'Unused' : 'Deactivated',
      k.entitlementDays || 'Default',
      k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '',
      (k as any).subEndDate ? new Date((k as any).subEndDate).toLocaleDateString() : '',
      (k as any).isRenewal ? 'Renewal' : (k as any).isUpgrade ? 'Upgrade' : 'New',
      (k as any).isUpgrade ? 'Yes' : 'No',
      (k as any).referredBy || '',      k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '',
      k.activatedAt ? new Date(k.activatedAt).toLocaleDateString() : '',
      k.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `package-keys-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const keys = keysQuery.data ?? [];
  const stats = statsQuery.data;
  const packages = packagesQuery.data ?? [];

  // Compute frozen count client-side
  const frozenCount = keys.filter((k: any) => k.isActive && k.activatedAt && (!!k.lexaiIsPaused || !!k.recIsPaused)).length;

  // Filter keys
  const filteredKeys = keys.filter((k: any) => {
    const matchesSearch = !searchQuery || 
      k.keyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.email && k.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (k.notes && k.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPackage = filterPackage === 'all' || String(k.packageId) === filterPackage;
    let matchesStatus = true;
    if (statusFilter === 'activated') matchesStatus = !!k.isActive && !!k.activatedAt;
    else if (statusFilter === 'unused') matchesStatus = !!k.isActive && !k.activatedAt;
    else if (statusFilter === 'deactivated') matchesStatus = !k.isActive;
    else if (statusFilter === 'frozen') matchesStatus = !!k.isActive && !!k.activatedAt && (!!k.lexaiIsPaused || !!k.recIsPaused);
    return matchesSearch && matchesPackage && matchesStatus;
  });

  // Pagination + sorting
  const {
    paged: pagedKeys,
    page,
    pageSize,
    totalPages,
    totalItems,
    sortKey,
    sortDir,
    setPage,
    handleSort,
    changePageSize,
  } = useDataTable(filteredKeys, keySortFns);

  const selectedPkg = packages.find((p: any) => p.id === selectedPackage);
  const isBasicPackage = selectedPkg?.slug === 'basic';

  const PackageSelector = () => (
    <div className="space-y-2">
      <Label>{language === 'ar' ? 'الباقة' : 'Package'}</Label>
      <Select
        value={selectedPackage ? String(selectedPackage) : ""}
        onValueChange={(v) => {
          const pkgId = parseInt(v);
          setSelectedPackage(pkgId);
          const pkg = packages.find((p: any) => p.id === pkgId);
          if (pkg) {
            setPrice(String(Math.round(pkg.price / 100)));
            if (pkg.slug === 'basic') {
              setIsUpgrade(false);
              setReferredBy("");
            }
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={language === 'ar' ? 'اختر الباقة...' : 'Select package...'} />
        </SelectTrigger>
        <SelectContent>
          {packages.map((pkg: any) => (
            <SelectItem key={pkg.id} value={String(pkg.id)}>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{language === 'ar' ? pkg.nameAr : pkg.nameEn}</span>
                <span className="text-xs text-gray-500">${(pkg.price / 100).toFixed(0)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6 text-emerald-600" />
              {language === 'ar' ? 'مفاتيح التفعيل' : 'Activation Keys'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {language === 'ar' 
                ? 'إنشاء وإدارة مفاتيح تفعيل الباقات' 
                : 'Generate and manage package activation keys'}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => resetForm()}>
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'مفتاح جديد' : 'New Key'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === 'ar' ? 'إنشاء مفتاح جديد' : 'Generate New Key'}</DialogTitle>
                  <DialogDescription>
                    {language === 'ar' 
                      ? 'إنشاء مفتاح تفعيل لباقة معينة' 
                      : 'Generate an activation key for a specific package'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <PackageSelector />
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'تعيين لبريد إلكتروني (اختياري)' : 'Assign to email (optional)'}</Label>
                    <Input
                      type="email"
                      value={assignEmail}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      placeholder={language === 'ar' ? 'user@example.com' : 'user@example.com'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'السعر ($)' : 'Price ($)'}</Label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'مدة الخدمة بالأيام' : 'Access duration (days)'}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={entitlementDays}
                      onChange={(e) => setEntitlementDays(e.target.value)}
                      placeholder={language === 'ar' ? 'اتركه فارغاً لاستخدام مدة الباقة' : 'Leave empty to use package default'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'آخر موعد لتفعيل المفتاح' : 'Redeem before'}</Label>
                    <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={language === 'ar' ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                    />
                  </div>
                  {/* Upgrade toggle - only for non-basic packages */}
                  {!isBasicPackage && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <input
                      type="checkbox"
                      id="isUpgrade"
                      checked={isUpgrade}
                      onChange={(e) => {
                        setIsUpgrade(e.target.checked);
                        if (e.target.checked) {
                          setIsRenewal(false);
                          // Upgrade price = Comprehensive minus Basic
                          const comprehensive = packages.find((p: any) => p.includesLexai);
                          const basic = packages.find((p: any) => !p.includesLexai);
                          const upgradePrice = comprehensive && basic
                            ? Math.round((comprehensive.price - basic.price) / 100)
                            : 300;
                          setPrice(String(upgradePrice));
                        } else {
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          setPrice(pkg ? String(Math.round(pkg.price / 100)) : '0');
                        }
                      }}
                      className="w-4 h-4 accent-amber-600"
                    />
                    <Label htmlFor="isUpgrade" className="flex items-center gap-2 cursor-pointer text-sm">
                      <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                      {language === 'ar' ? 'هذا ترقية (من الأساسية إلى الشاملة)' : 'This is an upgrade (Basic → Comprehensive)'}
                    </Label>
                  </div>
                  )}
                  {/* Renewal toggle */}
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <input
                      type="checkbox"
                      id="isRenewal"
                      checked={isRenewal}
                      onChange={(e) => {
                        setIsRenewal(e.target.checked);
                        if (e.target.checked) {
                          setIsUpgrade(false);
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          const isBasic = pkg && !pkg.includesLexai;
                          setPrice(isBasic ? '50' : '100');
                        } else {
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          setPrice(pkg ? String(Math.round(pkg.price / 100)) : '0');
                        }
                      }}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <Label htmlFor="isRenewal" className="flex items-center gap-2 cursor-pointer text-sm">
                      <RotateCcw className="w-4 h-4 text-emerald-600" />
                      {language === 'ar' ? 'هذا تجديد (يمدد اشتراكات المستخدم)' : 'This is a renewal (extends existing subscription)'}
                    </Label>
                  </div>
                  {isUpgrade && !isBasicPackage && (
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اسم العضو المُحوِّل' : 'Referred by (team member)'}</Label>
                      <Input
                        value={referredBy}
                        onChange={(e) => setReferredBy(e.target.value)}
                        placeholder={language === 'ar' ? 'اسم عضو الفريق الذي أقنعه...' : 'Name of team member who convinced them...'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'اتركه فارغاً إذا قرر العميل بنفسه' : 'Leave empty if the client decided on their own'}
                      </p>
                    </div>
                  )}
                  <Button onClick={handleGenerateKey} disabled={generateKey.isPending} className="w-full">
                    {generateKey.isPending 
                      ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...') 
                      : (language === 'ar' ? 'إنشاء المفتاح' : 'Generate Key')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" onClick={() => resetForm()}>
                  <Layers className="w-4 h-4" />
                  {language === 'ar' ? 'إنشاء دفعة' : 'Bulk Generate'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === 'ar' ? 'إنشاء مفاتيح بالجملة' : 'Bulk Generate Keys'}</DialogTitle>
                  <DialogDescription>
                    {language === 'ar' 
                      ? 'إنشاء عدة مفاتيح لباقة معينة دفعة واحدة' 
                      : 'Generate multiple keys for a package at once'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <PackageSelector />
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الكمية' : 'Quantity'}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={language === 'ar' ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'مدة الخدمة بالأيام' : 'Access duration (days)'}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={entitlementDays}
                      onChange={(e) => setEntitlementDays(e.target.value)}
                      placeholder={language === 'ar' ? 'اتركه فارغاً لاستخدام مدة الباقة' : 'Leave empty to use package default'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'آخر موعد لتفعيل المفتاح' : 'Redeem before'}</Label>
                    <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                  {/* Upgrade toggle for bulk - only for non-basic packages */}
                  {!isBasicPackage && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <input
                      type="checkbox"
                      id="isUpgradeBulk"
                      checked={isUpgrade}
                      onChange={(e) => {
                        setIsUpgrade(e.target.checked);
                        if (e.target.checked) {
                          setIsRenewal(false);
                          // Upgrade price = Comprehensive minus Basic
                          const comprehensive = packages.find((p: any) => p.includesLexai);
                          const basic = packages.find((p: any) => !p.includesLexai);
                          const upgradePrice = comprehensive && basic
                            ? Math.round((comprehensive.price - basic.price) / 100)
                            : 300;
                          setPrice(String(upgradePrice));
                        } else {
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          setPrice(pkg ? String(Math.round(pkg.price / 100)) : '0');
                        }
                      }}
                      className="w-4 h-4 accent-amber-600"
                    />
                    <Label htmlFor="isUpgradeBulk" className="flex items-center gap-2 cursor-pointer text-sm">
                      <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                      {language === 'ar' ? 'مفاتيح ترقية' : 'Upgrade keys'}
                    </Label>
                  </div>
                  )}
                  {/* Renewal toggle for bulk */}
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <input
                      type="checkbox"
                      id="isRenewalBulk"
                      checked={isRenewal}
                      onChange={(e) => {
                        setIsRenewal(e.target.checked);
                        if (e.target.checked) {
                          setIsUpgrade(false);
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          const isBasic = pkg && !pkg.includesLexai;
                          setPrice(isBasic ? '50' : '100');
                        } else {
                          const pkg = packages.find((p: any) => p.id === selectedPackage);
                          setPrice(pkg ? String(Math.round(pkg.price / 100)) : '0');
                        }
                      }}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <Label htmlFor="isRenewalBulk" className="flex items-center gap-2 cursor-pointer text-sm">
                      <RotateCcw className="w-4 h-4 text-emerald-600" />
                      {language === 'ar' ? 'مفاتيح تجديد' : 'Renewal keys'}
                    </Label>
                  </div>
                  {isUpgrade && !isBasicPackage && (
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اسم العضو المُحوِّل' : 'Referred by'}</Label>
                      <Input
                        value={referredBy}
                        onChange={(e) => setReferredBy(e.target.value)}
                        placeholder={language === 'ar' ? 'اسم عضو الفريق...' : 'Team member name...'}
                      />
                    </div>
                  )}
                  <Button onClick={handleGenerateBulk} disabled={generateBulk.isPending} className="w-full">
                    {generateBulk.isPending 
                      ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...') 
                      : (language === 'ar' ? `إنشاء ${quantity} مفاتيح` : `Generate ${quantity} Keys`)}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="icon" onClick={exportCSV} title="Export CSV">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards — clickable to filter */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {([
              { key: 'all' as const, value: stats.total, textCls: 'text-emerald-600', ringCls: 'ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: language === 'ar' ? 'الإجمالي' : 'Total' },
              { key: 'activated' as const, value: stats.activated, textCls: 'text-green-600', ringCls: 'ring-green-500 bg-green-50 dark:bg-green-950/30', label: language === 'ar' ? 'مفعّل' : 'Activated' },
              { key: 'unused' as const, value: stats.unused, textCls: 'text-amber-600', ringCls: 'ring-amber-500 bg-amber-50 dark:bg-amber-950/30', label: language === 'ar' ? 'غير مستخدم' : 'Unused' },
              { key: 'deactivated' as const, value: stats.deactivated, textCls: 'text-red-600', ringCls: 'ring-red-500 bg-red-50 dark:bg-red-950/30', label: language === 'ar' ? 'معطّل' : 'Deactivated' },
              { key: 'frozen' as const, value: frozenCount, textCls: 'text-cyan-600', ringCls: 'ring-cyan-500 bg-cyan-50 dark:bg-cyan-950/30', label: language === 'ar' ? 'مجمّد' : 'Frozen' },
            ] as const).map((s) => (
              <Card
                key={s.key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  statusFilter === s.key
                    ? `ring-2 ${s.ringCls}`
                    : 'hover:scale-[1.02]'
                }`}
                onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
              >
                <CardContent className="pt-4 pb-3 text-center">
                  <p className={`text-2xl font-bold ${s.textCls}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </CardContent>
              </Card>
            ))}
            {/* Activation Rate — not clickable */}
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.activationRate}%</p>
                <p className="text-xs text-gray-500">{language === 'ar' ? 'نسبة التفعيل' : 'Activation Rate'}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder={language === 'ar' ? 'بحث بالمفتاح أو البريد...' : 'Search by key or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterPackage} onValueChange={setFilterPackage}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'جميع الباقات' : 'All Packages'}</SelectItem>
                  {packages.map((pkg: any) => (
                    <SelectItem key={pkg.id} value={String(pkg.id)}>
                      {language === 'ar' ? pkg.nameAr : pkg.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Active status filter indicator */}
            {statusFilter !== 'all' && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                  {statusFilter === 'activated' && <><CheckCircle2 className="w-3 h-3 text-green-600" /> {language === 'ar' ? 'عرض: مفعّل' : 'Showing: Activated'}</>}
                  {statusFilter === 'unused' && <><Clock className="w-3 h-3 text-amber-600" /> {language === 'ar' ? 'عرض: غير مستخدم' : 'Showing: Unused'}</>}
                  {statusFilter === 'deactivated' && <><XCircle className="w-3 h-3 text-red-600" /> {language === 'ar' ? 'عرض: معطّل' : 'Showing: Deactivated'}</>}
                  {statusFilter === 'frozen' && <><Snowflake className="w-3 h-3 text-cyan-600" /> {language === 'ar' ? 'عرض: مجمّد' : 'Showing: Frozen'}</>}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Badge>
                <span className="text-xs text-gray-400">
                  {filteredKeys.length} {language === 'ar' ? 'مفتاح' : 'keys'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keys — Mobile Cards (below md) */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-semibold">
              {language === 'ar' ? 'المفاتيح' : 'Keys'}{' '}
              <span className="text-gray-400 font-normal">({filteredKeys.length})</span>
            </h3>
          </div>
          {filteredKeys.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                {language === 'ar' ? 'لا توجد مفاتيح' : 'No keys found'}
              </CardContent>
            </Card>
          ) : (
            pagedKeys.map((key: any) => (
              <Card key={key.id} className={!key.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-4 space-y-3">
                  {/* Row 1: Key code + copy */}
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded flex-1 truncate" dir="ltr">
                      {key.keyCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.keyCode)}
                      className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0 p-1"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Row 2: Badges — Package, Status, Type */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={`gap-1 text-xs ${getPackageBadgeClass(key.packageId)}`}>
                      <Package className="w-3 h-3" />
                      {language === 'ar' ? (key.packageNameAr || key.packageName) : key.packageName}
                    </Badge>
                    {!key.isActive ? (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <XCircle className="w-3 h-3" />
                        {language === 'ar' ? 'معطّل' : 'Deactivated'}
                      </Badge>
                    ) : key.activatedAt ? (
                      <>
                        <Badge className="gap-1 text-xs bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle2 className="w-3 h-3" />
                          {language === 'ar' ? 'مفعّل' : 'Activated'}
                        </Badge>
                        {(!!key.lexaiIsPaused || !!key.recIsPaused) && (
                          <Badge className="gap-1 text-xs bg-orange-100 text-orange-800 hover:bg-orange-100">
                            <PauseCircle className="w-3 h-3" />
                            {language === 'ar' ? 'مجمّد' : 'Frozen'}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        {language === 'ar' ? 'جاهز' : 'Unused'}
                      </Badge>
                    )}
                    {(key as any).isRenewal && (
                      <Badge className="gap-1 text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        <RotateCcw className="w-3 h-3" />
                        {language === 'ar' ? 'تجديد' : 'Renewal'}
                      </Badge>
                    )}
                    {(key as any).isUpgrade && !(key as any).isRenewal && (
                      <Badge className="gap-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <ArrowUpCircle className="w-3 h-3" />
                        {language === 'ar' ? 'ترقية' : 'Upgrade'}
                      </Badge>
                    )}
                  </div>

                  {/* Row 3: Email */}
                  {key.email && (
                    <p className="text-sm text-gray-700" dir="ltr">{key.email}</p>
                  )}

                  {/* Row 4: Key details grid — 2 columns */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-gray-400 block">{language === 'ar' ? 'السعر' : 'Price'}</span>
                      <span className="font-medium">{key.price ? `$${key.price}` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">
                        {key.activatedAt
                          ? (language === 'ar' ? 'انتهاء الاشتراك' : 'Sub Expiry')
                          : (language === 'ar' ? 'مدة الاشتراك' : 'Duration')}
                      </span>
                      <span className="font-medium">
                        {key.activatedAt
                          ? ((key as any).subEndDate
                              ? new Date((key as any).subEndDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')
                              : '—')
                          : (key.entitlementDays
                              ? `${key.entitlementDays} ${language === 'ar' ? 'يوم' : 'days'}`
                              : (language === 'ar' ? 'الافتراضي' : 'Default'))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">{language === 'ar' ? 'تاريخ التفعيل' : 'Activated'}</span>
                      <span className="font-medium">{key.activatedAt ? new Date(key.activatedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</span>
                      <span className="font-medium">{key.createdAt ? new Date(key.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '—'}</span>
                    </div>
                    {key.notes && (
                      <div>
                        <span className="text-gray-400 block">{language === 'ar' ? 'ملاحظات' : 'Notes'}</span>
                        <span className="font-medium truncate block">{key.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 5: Referred by */}
                  {(key as any).referredBy && (
                    <p className="text-xs text-amber-600">
                      {language === 'ar' ? 'بواسطة: ' : 'By: '}{(key as any).referredBy}
                    </p>
                  )}

                  {/* Row 6: Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed">
                    {key.isActive && key.activatedAt && key.userId && (
                      (!!key.lexaiIsPaused || !!key.recIsPaused) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                          onClick={() => unfreezeUser.mutate({ userId: key.userId as number })}
                          disabled={unfreezeUser.isPending}
                        >
                          <PlayCircle className="w-4 h-4" />
                          {language === 'ar' ? 'استئناف' : 'Unfreeze'}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-1"
                          onClick={() => setFreezeDialogUserId(key.userId as number)}
                          disabled={freezeUser.isPending}
                        >
                          <PauseCircle className="w-4 h-4" />
                          {language === 'ar' ? 'تجميد' : 'Freeze'}
                        </Button>
                      )
                    )}
                    {key.isActive && !key.activatedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                        onClick={() => setDeactivateDialogKey({ id: key.id, keyCode: key.keyCode })}
                      >
                        <XCircle className="w-4 h-4" />
                        {language === 'ar' ? 'إلغاء' : 'Deactivate'}
                      </Button>
                    )}
                    {!key.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                        onClick={() => reactivateKey.mutate({ id: key.id })}
                        disabled={reactivateKey.isPending}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {language === 'ar' ? 'إعادة تفعيل' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Keys — Desktop Table (md and up) */}
        <Card className="hidden md:block">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {language === 'ar' ? 'المفاتيح' : 'Keys'}{' '}
                <span className="text-gray-400 font-normal">({filteredKeys.length})</span>
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'الأعمدة' : 'Columns'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'} className="w-48">
                  <DropdownMenuLabel>{language === 'ar' ? 'إظهار / إخفاء الأعمدة' : 'Toggle Columns'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allColumns.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleCols.has(col.key)}
                      onCheckedChange={() => toggleCol(col.key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {language === 'ar' ? col.ar : col.en}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleCols.has('keyCode') && <TableHead><SortableHeader label={language === 'ar' ? 'المفتاح' : 'Key Code'} sortKey="keyCode" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('package') && <TableHead><SortableHeader label={language === 'ar' ? 'الباقة' : 'Package'} sortKey="package" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('email') && <TableHead><SortableHeader label={language === 'ar' ? 'البريد' : 'Email'} sortKey="email" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('status') && <TableHead><SortableHeader label={language === 'ar' ? 'الحالة' : 'Status'} sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('price') && <TableHead><SortableHeader label={language === 'ar' ? 'السعر' : 'Price'} sortKey="price" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('duration') && <TableHead>{language === 'ar' ? 'المدة / الانتهاء' : 'Duration / Expiry'}</TableHead>}
                    {visibleCols.has('activated') && <TableHead><SortableHeader label={language === 'ar' ? 'تاريخ التفعيل' : 'Activated'} sortKey="activated" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('created') && <TableHead><SortableHeader label={language === 'ar' ? 'تاريخ الإنشاء' : 'Created'} sortKey="created" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></TableHead>}
                    {visibleCols.has('notes') && <TableHead>{language === 'ar' ? 'ملاحظات' : 'Notes'}</TableHead>}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColCount} className="text-center py-8 text-gray-500">
                        {language === 'ar' ? 'لا توجد مفاتيح' : 'No keys found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedKeys.map((key: any, i: number) => (
                      <TableRow key={key.id} className={zebraRow(i, !key.isActive ? 'opacity-50' : '')}>
                        {visibleCols.has('keyCode') && <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {key.keyCode}
                            </code>
                            <button
                              onClick={() => copyToClipboard(key.keyCode)}
                              className="text-gray-400 hover:text-emerald-600 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>}
                        {visibleCols.has('package') && <TableCell>
                          <Badge variant="outline" className={`gap-1 ${getPackageBadgeClass(key.packageId)}`}>
                            <Package className="w-3 h-3" />
                            {language === 'ar' ? (key.packageNameAr || key.packageName) : key.packageName}
                          </Badge>
                        </TableCell>}
                        {visibleCols.has('email') && <TableCell>
                          {key.email ? (
                            <span className="text-sm">{key.email}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>}
                        {visibleCols.has('status') && <TableCell>
                          {!key.isActive ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              {language === 'ar' ? 'معطّل' : 'Deactivated'}
                            </Badge>
                          ) : key.activatedAt ? (
                            <div className="flex flex-wrap gap-1">
                              <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                <CheckCircle2 className="w-3 h-3" />
                                {language === 'ar' ? 'مفعّل' : 'Activated'}
                              </Badge>
                              {(!!key.lexaiIsPaused || !!key.recIsPaused) && (
                                <Badge className="gap-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
                                  <PauseCircle className="w-3 h-3" />
                                  {language === 'ar' ? 'مجمّد' : 'Frozen'}
                                </Badge>
                              )}
                              {(key as any).isRenewal && (
                                <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  <RotateCcw className="w-3 h-3" />
                                  {language === 'ar' ? 'تجديد' : 'Renewal'}
                                </Badge>
                              )}
                              {(key as any).isUpgrade && !(key as any).isRenewal && (
                                <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                                  <ArrowUpCircle className="w-3 h-3" />
                                  {language === 'ar' ? 'ترقية' : 'Upgrade'}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="w-3 h-3" />
                              {language === 'ar' ? 'جاهز' : 'Unused'}
                            </Badge>
                          )}
                        </TableCell>}
                        {visibleCols.has('price') && <TableCell className="text-sm font-medium">
                          {key.price ? `$${key.price}` : '—'}
                        </TableCell>}
                        {visibleCols.has('duration') && <TableCell className="text-xs">
                          {key.activatedAt
                            ? ((key as any).subEndDate
                                ? <span className="text-gray-600">{new Date((key as any).subEndDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                                : <span className="text-gray-400">—</span>)
                            : <span className="text-gray-500">{key.entitlementDays ? `${key.entitlementDays} ${language === 'ar' ? 'يوم' : 'days'}` : (language === 'ar' ? 'الافتراضي' : 'Default')}</span>}
                        </TableCell>}
                        {visibleCols.has('activated') && <TableCell className="text-xs text-gray-500">
                          {key.activatedAt ? new Date(key.activatedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '—'}
                        </TableCell>}
                        {visibleCols.has('created') && <TableCell className="text-xs text-gray-500">
                          {key.createdAt ? new Date(key.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '—'}
                        </TableCell>}
                        {visibleCols.has('notes') && <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">
                          {key.notes || '—'}
                          {(key as any).referredBy && (
                            <span className="block text-amber-600 mt-0.5">
                              {language === 'ar' ? 'بواسطة: ' : 'By: '}{(key as any).referredBy}
                            </span>
                          )}
                        </TableCell>}
                        <TableCell>
                          {key.isActive && key.activatedAt && key.userId && (
                            (!!key.lexaiIsPaused || !!key.recIsPaused) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => unfreezeUser.mutate({ userId: key.userId as number })}
                                disabled={unfreezeUser.isPending}
                                title={language === 'ar' ? 'استئناف الاشتراكات' : 'Unfreeze subscriptions'}
                              >
                                <PlayCircle className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => setFreezeDialogUserId(key.userId as number)}
                                disabled={freezeUser.isPending}
                                title={language === 'ar' ? 'تجميد الاشتراكات' : 'Freeze subscriptions'}
                              >
                                <PauseCircle className="w-4 h-4" />
                              </Button>
                            )
                          )}
                          {key.isActive && !key.activatedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeactivateDialogKey({ id: key.id, keyCode: key.keyCode })}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {!key.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => reactivateKey.mutate({ id: key.id })}
                              disabled={reactivateKey.isPending}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Keys Pagination */}
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          setPage={setPage}
          changePageSize={changePageSize}
          isRtl={language === 'ar'}
        />

        {/* Upgrade Leaderboard */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {language === 'ar' ? 'لوحة قيادة الترقيات' : 'Upgrade Leaderboard'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'تتبع الترقيات من الباقة الأساسية إلى الشاملة' 
                    : 'Track upgrades from Basic to Comprehensive package'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs whitespace-nowrap mr-1">{language === 'ar' ? 'الشهر:' : 'Month:'}</Label>
                <button
                  onClick={() => {
                    const [y, m] = selectedMonth.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Previous month"
                >
                  ‹
                </button>
                <span className="text-sm font-medium px-2 min-w-[90px] text-center" dir="ltr">
                  {new Date(selectedMonth + '-01').toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={() => {
                    const [y, m] = selectedMonth.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Next month"
                >
                  ›
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {upgradeStatsQuery.data ? (
              <div className="space-y-4">
                {/* Upgrade summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <ArrowUpCircle className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{upgradeStatsQuery.data.monthlyUpgrades}</p>
                      <p className="text-xs text-gray-500">{language === 'ar' ? 'ترقيات هذا الشهر' : 'This Month'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-emerald-500" />
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{upgradeStatsQuery.data.totalUpgrades}</p>
                      <p className="text-xs text-gray-500">{language === 'ar' ? 'إجمالي الترقيات' : 'All-time'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <Trophy className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {upgradeStatsQuery.data.leaderboard.length > 0 
                          ? upgradeStatsQuery.data.leaderboard[0].referredBy 
                          : (language === 'ar' ? '—' : '—')}
                      </p>
                      <p className="text-xs text-gray-500">{language === 'ar' ? 'الأفضل هذا الشهر' : 'Top This Month'}</p>
                    </div>
                  </div>
                </div>

                {/* Monthly leaderboard table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      {language === 'ar' ? `ترتيب شهر ${selectedMonth}` : `${selectedMonth} Rankings`}
                    </h4>
                    {upgradeStatsQuery.data.leaderboard.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        {language === 'ar' ? 'لا توجد ترقيات بإحالات هذا الشهر' : 'No referred upgrades this month'}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>{language === 'ar' ? 'العضو' : 'Member'}</TableHead>
                            <TableHead className="text-center">{language === 'ar' ? 'الترقيات' : 'Upgrades'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upgradeStatsQuery.data.leaderboard.map((entry, index) => (
                            <TableRow key={entry.referredBy}>
                              <TableCell>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                              </TableCell>
                              <TableCell className="font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                {entry.referredBy}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{entry.count}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* All-time */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      {language === 'ar' ? 'الترتيب العام' : 'All-Time Rankings'}
                    </h4>
                    {(upgradeStatsQuery.data.allTimeLeaderboard?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        {language === 'ar' ? 'لا توجد ترقيات بإحالات بعد' : 'No referred upgrades yet'}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>{language === 'ar' ? 'العضو' : 'Member'}</TableHead>
                            <TableHead className="text-center">{language === 'ar' ? 'الترقيات' : 'Upgrades'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upgradeStatsQuery.data.allTimeLeaderboard?.map((entry, index) => (
                            <TableRow key={entry.referredBy}>
                              <TableCell>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                              </TableCell>
                              <TableCell className="font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                {entry.referredBy}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{entry.count}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={!!deactivateDialogKey} onOpenChange={(open) => { if (!open) { setDeactivateDialogKey(null); setDeactivateReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تأكيد إلغاء التفعيل' : 'Confirm Deactivation'}</DialogTitle>
            <DialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من إلغاء تفعيل المفتاح ${deactivateDialogKey?.keyCode}؟`
                : `Are you sure you want to deactivate key ${deactivateDialogKey?.keyCode}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{language === 'ar' ? 'سبب الإلغاء (اختياري)' : 'Reason (optional)'}</Label>
              <Textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل السبب...' : 'Enter reason...'}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeactivateDialogKey(null); setDeactivateReason(""); }}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              disabled={deactivateKey.isPending}
              onClick={() => {
                if (deactivateDialogKey) {
                  deactivateKey.mutate({ id: deactivateDialogKey.id, reason: deactivateReason.trim() || undefined });
                }
              }}
            >
              {deactivateKey.isPending
                ? (language === 'ar' ? 'جارٍ...' : 'Deactivating...')
                : (language === 'ar' ? 'تأكيد الإلغاء' : 'Deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze Subscription Dialog */}
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
              disabled={freezeUser.isPending}
              onClick={() => {
                if (freezeDialogUserId) {
                  freezeUser.mutate({
                    userId: freezeDialogUserId,
                    reason: freezeReason.trim() || undefined,
                    frozenUntilDays: freezeDays ? parseInt(freezeDays, 10) : undefined,
                  });
                }
              }}
            >
              {freezeUser.isPending
                ? (language === 'ar' ? 'جارٍ...' : 'Freezing...')
                : (language === 'ar' ? 'تجميد' : 'Freeze')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
