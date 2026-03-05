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

  // Data queries
  const keysQuery = trpc.packageKeys.list.useQuery();
  const statsQuery = trpc.packageKeys.stats.useQuery();
  const packagesQuery = trpc.packages.list.useQuery();

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
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!');
  };

  const exportCSV = () => {
    const keys = filteredKeys;
    if (!keys.length) return;
    const headers = ['Key Code', 'Package', 'Email', 'Status', 'Created', 'Activated', 'Notes'];
    const rows = keys.map(k => [
      k.keyCode,
      (k as any).packageName || '',
      k.email || '',
      k.activatedAt ? 'Activated' : k.isActive ? 'Unused' : 'Deactivated',
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
                        <TableCell className="text-xs text-gray-500">
                          {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {key.activatedAt ? new Date(key.activatedAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">
                          {key.notes || '—'}
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
      </div>
    </DashboardLayout>
  );
}
