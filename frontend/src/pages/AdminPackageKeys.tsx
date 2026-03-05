import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";

export default function AdminPackageKeys() {
  const { t, language } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("0");
  const [assignEmail, setAssignEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isUpgrade, setIsUpgrade] = useState(false);
  const [referredBy, setReferredBy] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

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
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setSelectedPackage(null);
    setQuantity("1");
    setNotes("");
    setPrice("0");
    setAssignEmail("");
    setIsUpgrade(false);
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
      isUpgrade: isUpgrade || undefined,
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
      isUpgrade: isUpgrade || undefined,
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
    const headers = ['Key Code', 'Package', 'Email', 'Status', 'Upgrade', 'Referred By', 'Created', 'Activated', 'Notes'];
    const rows = keys.map(k => [
      k.keyCode,
      (k as any).packageName || '',
      k.email || '',
      k.activatedAt ? 'Activated' : k.isActive ? 'Unused' : 'Deactivated',
      (k as any).isUpgrade ? 'Yes' : 'No',
      (k as any).referredBy || '',
      k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '',
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

  // Filter keys
  const filteredKeys = keys.filter(k => {
    const matchesSearch = !searchQuery || 
      k.keyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.email && k.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (k.notes && k.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPackage = filterPackage === 'all' || String(k.packageId) === filterPackage;
    return matchesSearch && matchesPackage;
  });

  const PackageSelector = () => (
    <div className="space-y-2">
      <Label>{language === 'ar' ? 'الباقة' : 'Package'}</Label>
      <Select
        value={selectedPackage ? String(selectedPackage) : ""}
        onValueChange={(v) => setSelectedPackage(parseInt(v))}
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
              <Key className="w-6 h-6 text-blue-600" />
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
                    <Label>{language === 'ar' ? 'السعر (سنت)' : 'Price (cents)'}</Label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
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
                  {/* Upgrade toggle */}
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <input
                      type="checkbox"
                      id="isUpgrade"
                      checked={isUpgrade}
                      onChange={(e) => setIsUpgrade(e.target.checked)}
                      className="w-4 h-4 accent-amber-600"
                    />
                    <Label htmlFor="isUpgrade" className="flex items-center gap-2 cursor-pointer text-sm">
                      <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                      {language === 'ar' ? 'هذا ترقية (من الأساسية إلى الشاملة)' : 'This is an upgrade (Basic → Comprehensive)'}
                    </Label>
                  </div>
                  {isUpgrade && (
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
                  {/* Upgrade toggle for bulk */}
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <input
                      type="checkbox"
                      id="isUpgradeBulk"
                      checked={isUpgrade}
                      onChange={(e) => setIsUpgrade(e.target.checked)}
                      className="w-4 h-4 accent-amber-600"
                    />
                    <Label htmlFor="isUpgradeBulk" className="flex items-center gap-2 cursor-pointer text-sm">
                      <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                      {language === 'ar' ? 'مفاتيح ترقية' : 'Upgrade keys'}
                    </Label>
                  </div>
                  {isUpgrade && (
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                <p className="text-xs text-gray-500">{language === 'ar' ? 'الإجمالي' : 'Total'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.activated}</p>
                <p className="text-xs text-gray-500">{language === 'ar' ? 'مفعّل' : 'Activated'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.unused}</p>
                <p className="text-xs text-gray-500">{language === 'ar' ? 'غير مستخدم' : 'Unused'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.deactivated}</p>
                <p className="text-xs text-gray-500">{language === 'ar' ? 'معطّل' : 'Deactivated'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.activationRate}%</p>
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
          </CardContent>
        </Card>

        {/* Keys Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {language === 'ar' ? 'المفاتيح' : 'Keys'}{' '}
              <span className="text-gray-400 font-normal">({filteredKeys.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'المفتاح' : 'Key Code'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الباقة' : 'Package'}</TableHead>
                    <TableHead>{language === 'ar' ? 'البريد' : 'Email'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'ترقية' : 'Upgrade'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ التفعيل' : 'Activated'}</TableHead>
                    <TableHead>{language === 'ar' ? 'ملاحظات' : 'Notes'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {language === 'ar' ? 'لا توجد مفاتيح' : 'No keys found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredKeys.map((key: any) => (
                      <TableRow key={key.id} className={!key.isActive ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {key.keyCode}
                            </code>
                            <button
                              onClick={() => copyToClipboard(key.keyCode)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Package className="w-3 h-3" />
                            {language === 'ar' ? (key.packageNameAr || key.packageName) : key.packageName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {key.email ? (
                            <span className="text-sm">{key.email}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!key.isActive ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              {language === 'ar' ? 'معطّل' : 'Deactivated'}
                            </Badge>
                          ) : key.activatedAt ? (
                            <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="w-3 h-3" />
                              {language === 'ar' ? 'مفعّل' : 'Activated'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="w-3 h-3" />
                              {language === 'ar' ? 'جاهز' : 'Unused'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {(key as any).isUpgrade ? (
                            <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                              <ArrowUpCircle className="w-3 h-3" />
                              {language === 'ar' ? 'ترقية' : 'Upgrade'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {key.activatedAt ? new Date(key.activatedAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">
                          {key.notes || '—'}
                          {(key as any).referredBy && (
                            <span className="block text-amber-600 mt-0.5">
                              {language === 'ar' ? 'بواسطة: ' : 'By: '}{(key as any).referredBy}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {key.isActive && !key.activatedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(language === 'ar' ? 'هل أنت متأكد من إلغاء تفعيل هذا المفتاح؟' : 'Deactivate this key?')) {
                                  deactivateKey.mutate({ id: key.id });
                                }
                              }}
                            >
                              <XCircle className="w-4 h-4" />
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
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">{language === 'ar' ? 'الشهر:' : 'Month:'}</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-[160px] text-sm"
                  dir="ltr"
                />
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
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{upgradeStatsQuery.data.totalUpgrades}</p>
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
                      <TrendingUp className="w-4 h-4 text-blue-500" />
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
    </DashboardLayout>
  );
}
