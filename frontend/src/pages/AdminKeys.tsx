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
} from "lucide-react";

export default function AdminKeys() {
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("0");
  const [searchEmail, setSearchEmail] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Queries
  const { data: courses } = trpc.courses.getAllCourses.useQuery();
  const { data: allKeys, refetch: refetchKeys } = trpc.registrationKeys.getAllKeys.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.registrationKeys.getStatistics.useQuery();

  // Mutations
  const generateKey = trpc.registrationKeys.generateKey.useMutation({
    onSuccess: () => {
      toast.success("Registration key generated successfully!");
      setShowGenerateDialog(false);
      setNotes("");
      setPrice("0");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generateBulkKeys = trpc.registrationKeys.generateBulkKeys.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} registration keys generated successfully!`);
      setShowBulkDialog(false);
      setQuantity("1");
      setNotes("");
      setPrice("0");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deactivateKey = trpc.registrationKeys.deactivateKey.useMutation({
    onSuccess: () => {
      toast.success("Key deactivated successfully");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { t } = useLanguage();

  const handleGenerateSingle = () => {
    if (!selectedCourse) {
      toast.error("Please select a course");
      return;
    }
    const priceValue = parseFloat(price) || 0;
    generateKey.mutate({
      courseId: selectedCourse,
      notes: notes || undefined,
      price: priceValue,
    });
  };

  const handleGenerateBulk = () => {
    if (!selectedCourse) {
      toast.error("Please select a course");
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast.error("Quantity must be between 1 and 1000");
      return;
    }
    const priceValue = parseFloat(price) || 0;
    generateBulkKeys.mutate({
      courseId: selectedCourse,
      quantity: qty,
      notes: notes || undefined,
      price: priceValue,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const exportKeysToCSV = () => {
    if (!allKeys || allKeys.length === 0) {
      toast.error("No keys to export");
      return;
    }

    const csv = [
      ["Key Code", "Course ID", "Email", "Status", "Created At", "Activated At", "Notes"],
      ...allKeys.map((key) => [
        key.keyCode,
        key.courseId.toString(),
        key.email || "Not activated",
        key.isActive ? "Active" : "Deactivated",
        new Date(key.createdAt).toLocaleString(),
        key.activatedAt ? new Date(key.activatedAt).toLocaleString() : "N/A",
        key.notes || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registration-keys-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Keys exported successfully!");
  };

  const filteredKeys = searchEmail
    ? allKeys?.filter((key) =>
        key.email?.toLowerCase().includes(searchEmail.toLowerCase())
      )
    : allKeys;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.keys.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.keys.manageCourseAccess')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.keys.generateKey')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('admin.keys.generateSingle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.keys.createKeyDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('admin.keys.course')}</Label>
                  <Select
                    value={selectedCourse?.toString()}
                    onValueChange={(value) => setSelectedCourse(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.keys.selectCourse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id.toString()}>
                          {course.titleEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.keys.notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this key..."
                  />
                </div>
                <div>
                  <Label>{t('admin.keys.price')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  onClick={handleGenerateSingle}
                  disabled={generateKey.isPending}
                  className="w-full"
                >
                  {generateKey.isPending ? t('admin.keys.generating') : t('admin.keys.generateKey')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="mr-2 h-4 w-4" />
                {t('admin.keys.bulkGenerate')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('admin.keys.bulkTitle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.keys.bulkDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('admin.keys.course')}</Label>
                  <Select
                    value={selectedCourse?.toString()}
                    onValueChange={(value) => setSelectedCourse(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.keys.selectCourse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id.toString()}>
                          {course.titleEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.keys.quantity')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <Label>{t('admin.keys.notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about these keys..."
                  />
                </div>
                <div>
                  <Label>{t('admin.keys.price')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  onClick={handleGenerateBulk}
                  disabled={generateBulkKeys.isPending}
                  className="w-full"
                >
                  {generateBulkKeys.isPending
                    ? t('admin.keys.generating')
                    : `${t('admin.keys.generateKey')} (${quantity})`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={exportKeysToCSV}>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.keys.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.keys.totalKeys')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.keys.activated')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.activated}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.keys.unused')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.unused}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.keys.deactivated')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.deactivated}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('admin.keys.activationRate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activationRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.keys.searchKeys')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.keys.searchByEmail')}
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.keys.allKeys')} ({filteredKeys?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.keys.keyCode')}</TableHead>
                  <TableHead>{t('admin.keys.course')}</TableHead>
                  <TableHead>{t('admin.keys.email')}</TableHead>
                  <TableHead>{t('admin.keys.statusLabel')}</TableHead>
                  <TableHead>{t('admin.keys.created')}</TableHead>
                  <TableHead>{t('admin.keys.activatedDate')}</TableHead>
                  <TableHead>{t('admin.keys.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys?.map((key) => {
                  const course = courses?.find((c) => c.id === key.courseId);
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {key.keyCode}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.keyCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{course?.titleEn || "Unknown"}</TableCell>
                      <TableCell>
                        {key.email || (
                          <span className="text-muted-foreground">
                            {t('admin.keys.notActivated')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.isActive ? (
                          key.email ? (
                            <Badge variant="default">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t('admin.keys.activated')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="mr-1 h-3 w-3" />
                              {t('admin.keys.unused')}
                            </Badge>
                          )
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                              {t('admin.keys.deactivated')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {key.activatedAt
                          ? new Date(key.activatedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {key.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deactivateKey.mutate({ keyId: key.id })
                            }
                          >
                            {t('admin.keys.deactivate')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
