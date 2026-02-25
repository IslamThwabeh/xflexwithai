import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Key, UserCog } from "lucide-react";

export default function AdminRecommendations() {
  const [quantity, setQuantity] = useState("1");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();

  const { data: users = [] } = trpc.users.list.useQuery();
  const { data: analysts = [] } = trpc.recommendationAdmin.listAnalysts.useQuery();
  const { data: keys = [] } = trpc.recommendationAdmin.keys.list.useQuery();
  const { data: stats } = trpc.recommendationAdmin.keys.stats.useQuery();

  const analystIds = useMemo(() => new Set(analysts.map((a: any) => a.id)), [analysts]);

  const setAnalystMutation = trpc.recommendationAdmin.setAnalyst.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث صلاحية المحلل");
      utils.recommendationAdmin.listAnalysts.invalidate();
      utils.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const generateKeyMutation = trpc.recommendationAdmin.keys.generateKey.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء مفتاح توصيات");
      utils.recommendationAdmin.keys.list.invalidate();
      utils.recommendationAdmin.keys.stats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const generateBulkMutation = trpc.recommendationAdmin.keys.generateBulkKeys.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء ${data.count} مفتاح`);
      utils.recommendationAdmin.keys.list.invalidate();
      utils.recommendationAdmin.keys.stats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deactivateMutation = trpc.recommendationAdmin.keys.deactivateKey.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف المفتاح");
      utils.recommendationAdmin.keys.list.invalidate();
      utils.recommendationAdmin.keys.stats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredUsers = users.filter((user: any) => {
    const value = search.toLowerCase();
    return (user.name || "").toLowerCase().includes(value) || (user.email || "").toLowerCase().includes(value);
  });

  const copyKey = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("تم نسخ المفتاح");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold">إدارة قروب التوصيات</h1>
          <p className="text-muted-foreground">تحديد المحلل المسؤول + مفاتيح الاشتراك الشهرية (30 يوم)</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">إجمالي المفاتيح</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.total ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">مفعلة</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.activated ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">غير مستخدمة</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.unused ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">معطلة</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.deactivated ?? 0}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> تعيين المحلل</CardTitle>
            <CardDescription>يمكن تغيير المحلل في أي وقت من هنا</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="بحث بالاسم أو البريد" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      {isAnalyst ? "إزالة صلاحية المحلل" : "تعيين كمحلل"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> مفاتيح قروب التوصيات</CardTitle>
            <CardDescription>كل مفتاح يفعّل اشتراكًا لمدة 30 يوم</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => generateKeyMutation.mutate({})}>إنشاء مفتاح واحد</Button>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                type="number"
                min={1}
                max={1000}
                className="w-28"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const parsed = parseInt(quantity, 10);
                  if (Number.isNaN(parsed) || parsed < 1 || parsed > 1000) {
                    toast.error("الكمية بين 1 و 1000");
                    return;
                  }
                  generateBulkMutation.mutate({ quantity: parsed });
                }}
              >
                إنشاء دفعة
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المفتاح</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ التفعيل</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key: any) => {
                  const status = !key.isActive ? "معطل" : key.activatedAt ? "مستخدم" : "متاح";
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-xs">{key.keyCode}</TableCell>
                      <TableCell>{key.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={status === "متاح" ? "default" : "secondary"}>{status}</Badge>
                      </TableCell>
                      <TableCell>{key.activatedAt ? new Date(key.activatedAt).toLocaleString("ar-SA") : "-"}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => copyKey(key.keyCode)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!key.isActive}
                          onClick={() => deactivateMutation.mutate({ keyId: key.id })}
                        >
                          تعطيل
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
