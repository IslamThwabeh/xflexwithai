import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Shield, UserPlus, Trash2, Search, Users, Phone, Mail, X, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { labelKey: string; color: string; group: string }> = {
  analyst: { labelKey: "admin.roles.analyst", color: "bg-purple-100 text-purple-800", group: "Core Roles" },
  support: { labelKey: "admin.roles.support", color: "bg-blue-100 text-blue-800", group: "Core Roles" },
  key_manager: { labelKey: "admin.roles.keyManager", color: "bg-amber-100 text-amber-800", group: "Core Roles" },
  view_progress: { labelKey: "admin.roles.viewProgress", color: "bg-green-100 text-green-800", group: "Support Permissions" },
  view_recommendations: { labelKey: "admin.roles.viewRec", color: "bg-pink-100 text-pink-800", group: "Support Permissions" },
  view_subscriptions: { labelKey: "admin.roles.viewSubs", color: "bg-cyan-100 text-cyan-800", group: "Support Permissions" },
  view_quizzes: { labelKey: "admin.roles.viewQuizzes", color: "bg-orange-100 text-orange-800", group: "Support Permissions" },
  client_lookup: { labelKey: "admin.roles.clientLookup", color: "bg-indigo-100 text-indigo-800", group: "Support Permissions" },
};

const ALL_ROLES = Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>;
type RoleKey = "analyst" | "support" | "key_manager" | "view_progress" | "view_recommendations" | "view_subscriptions" | "view_quizzes" | "client_lookup";

export default function AdminRoles() {
  const [search, setSearch] = useState("");
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");

  // Add Staff form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<RoleKey[]>([]);

  // Assign role to existing staff
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignRole, setAssignNewRole] = useState<string>("analyst");

  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const { data: staffMembers, isLoading, refetch: refetchStaff } = trpc.roles.listStaff.useQuery();
  const { data: roleAssignments, refetch: refetchRoles } = trpc.roles.list.useQuery();

  const createStaffMutation = trpc.roles.createStaff.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إضافة الموظف بنجاح' : 'Staff member added successfully');
      refetchStaff();
      refetchRoles();
      setShowAddStaff(false);
      resetAddForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeStaffMutation = trpc.roles.removeStaff.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إزالة الموظف' : 'Staff member removed');
      refetchStaff();
      refetchRoles();
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.roles.assign.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم تعيين الدور بنجاح' : 'Role assigned successfully');
      refetchStaff();
      refetchRoles();
      setShowAssignRole(false);
      setAssignStaffId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.roles.remove.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إزالة الدور' : 'Role removed');
      refetchStaff();
      refetchRoles();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetAddForm() {
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setSelectedRoles([]);
  }

  function toggleRole(role: RoleKey) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  function handleCreateStaff() {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error(isRtl ? 'الاسم والبريد مطلوبان' : 'Name and email are required');
      return;
    }
    if (selectedRoles.length === 0) {
      toast.error(isRtl ? 'اختر دور واحد على الأقل' : 'Select at least one role');
      return;
    }
    createStaffMutation.mutate({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim() || undefined,
      roles: selectedRoles,
    });
  }

  function handleAssignRole() {
    const id = parseInt(assignStaffId, 10);
    if (!id) return;
    assignMutation.mutate({
      userId: id,
      role: assignRole as RoleKey,
    });
  }

  // Filtered staff members
  const filteredStaff = (staffMembers ?? []).filter(s => {
    if (filterRole !== "all" && !s.roles.includes(filterRole)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  });

  // Role counts from staff members
  const roleCounts = ALL_ROLES.map(role => ({
    role,
    count: (staffMembers ?? []).filter(s => s.roles.includes(role as string)).length,
  }));

  const totalStaff = staffMembers?.length ?? 0;

  // Staff who don't have the selected assign role yet
  const staffForAssign = (staffMembers ?? []).filter(s => {
    return !s.roles.includes(assignRole);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7" /> {t('admin.roles.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('admin.roles.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Assign Role to Existing Staff */}
            <Dialog open={showAssignRole} onOpenChange={setShowAssignRole}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className={`h-4 w-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  <span className="hidden sm:inline">{t('admin.roles.assignRole')}</span>
                  <span className="sm:hidden">{isRtl ? 'دور' : 'Role'}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('admin.roles.assignToUser')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('admin.roles.selectRole')}</label>
                    <select
                      value={assignRole}
                      onChange={(e) => setAssignNewRole(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <optgroup label={t('admin.roles.coreRoles')}>
                        {Object.entries(ROLE_LABELS).filter(([, v]) => v.group === "Core Roles").map(([key, val]) => (
                          <option key={key} value={key}>{t(val.labelKey)}</option>
                        ))}
                      </optgroup>
                      <optgroup label={t('admin.roles.supportPerms')}>
                        {Object.entries(ROLE_LABELS).filter(([, v]) => v.group === "Support Permissions").map(([key, val]) => (
                          <option key={key} value={key}>{t(val.labelKey)}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {isRtl ? 'اختر الموظف' : 'Select Staff Member'}
                    </label>
                    <select
                      value={assignStaffId}
                      onChange={(e) => setAssignStaffId(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">{isRtl ? 'اختر...' : 'Select...'}</option>
                      {staffForAssign.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.email} ({s.email})
                        </option>
                      ))}
                    </select>
                    {staffForAssign.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRtl ? 'جميع الموظفين لديهم هذا الدور بالفعل' : 'All staff already have this role'}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleAssignRole}
                    disabled={assignMutation.isPending || !assignStaffId}
                    className="w-full"
                  >
                    {assignMutation.isPending
                      ? (isRtl ? 'جار التعيين...' : 'Assigning...')
                      : t('admin.roles.assignRole')
                    }
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add New Staff */}
            <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className={`h-4 w-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  <span className="hidden sm:inline">{isRtl ? 'إضافة موظف' : 'Add Staff'}</span>
                  <span className="sm:hidden">{isRtl ? 'موظف' : 'Staff'}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{isRtl ? 'إضافة موظف جديد' : 'Add New Staff Member'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {isRtl ? 'الاسم' : 'Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={isRtl ? 'اسم الموظف' : 'Staff name'}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {isRtl ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="staff@example.com"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {isRtl ? 'رقم الهاتف' : 'Phone'} ({isRtl ? 'اختياري' : 'optional'})
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+962..."
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {isRtl ? 'الأدوار' : 'Roles'} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ALL_ROLES.map((role) => {
                        const info = ROLE_LABELS[role];
                        const isSelected = selectedRoles.includes(role as RoleKey);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(role as RoleKey)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isSelected
                                ? `${info.color} border-current ring-1 ring-current`
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {t(info.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedRoles.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {isRtl ? `${selectedRoles.length} أدوار محددة` : `${selectedRoles.length} role(s) selected`}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleCreateStaff}
                    disabled={createStaffMutation.isPending}
                    className="w-full"
                  >
                    {createStaffMutation.isPending
                      ? (isRtl ? 'جار الإضافة...' : 'Adding...')
                      : (isRtl ? 'إضافة الموظف' : 'Add Staff Member')
                    }
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            className={`cursor-pointer transition-all ${filterRole === 'all' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setFilterRole('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalStaff}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? 'إجمالي الموظفين' : 'Total Staff'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {roleCounts.filter(({ role }) => ROLE_LABELS[role]?.group === "Core Roles").map(({ role, count }) => (
            <Card
              key={role}
              className={`cursor-pointer transition-all ${filterRole === role ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
              onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
            >
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{t(ROLE_LABELS[role].labelKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter indicator */}
        {filterRole !== 'all' && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {isRtl ? 'تصفية:' : 'Filter:'} {ROLE_LABELS[filterRole] ? t(ROLE_LABELS[filterRole].labelKey) : filterRole}
              <button onClick={() => setFilterRole('all')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <input
            type="text"
            placeholder={isRtl ? 'بحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email or phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border rounded-md text-sm`}
          />
        </div>

        {/* Staff Members */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{isRtl ? 'فريق العمل' : 'Staff Members'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                {isRtl ? 'جار التحميل...' : 'Loading...'}
              </p>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {totalStaff === 0
                    ? (isRtl ? 'لا يوجد موظفين بعد. أضف أول موظف!' : 'No staff yet. Add your first staff member!')
                    : (isRtl ? 'لا توجد نتائج' : 'No results found')
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredStaff.map((s) => (
                    <div
                      key={s.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{s.name || '—'}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate" dir="ltr">{s.email}</span>
                          </div>
                          {s.phone && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span dir="ltr">{s.phone}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          onClick={() => {
                            if (confirm(isRtl ? 'هل أنت متأكد من إزالة هذا الموظف؟' : 'Remove this staff member?')) {
                              removeStaffMutation.mutate({ userId: s.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.roles.map((role) => {
                          const info = ROLE_LABELS[role];
                          return (
                            <div key={role} className="flex items-center gap-1">
                              <Badge variant="secondary" className={`text-[10px] ${info?.color ?? ''}`}>
                                {info ? t(info.labelKey) : role}
                              </Badge>
                              <button
                                onClick={() => removeMutation.mutate({ userId: s.id, role: role as RoleKey })}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                title={isRtl ? 'إزالة الدور' : 'Remove role'}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {isRtl ? 'أضيف: ' : 'Added: '}
                        {new Date(s.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                        {s.lastSignedIn && (
                          <>
                            {' · '}
                            {isRtl ? 'آخر دخول: ' : 'Last login: '}
                            {new Date(s.lastSignedIn).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRtl ? 'البريد' : 'Email'}</TableHead>
                        <TableHead>{isRtl ? 'الهاتف' : 'Phone'}</TableHead>
                        <TableHead>{isRtl ? 'الأدوار' : 'Roles'}</TableHead>
                        <TableHead>{isRtl ? 'تاريخ الإضافة' : 'Added'}</TableHead>
                        <TableHead>{isRtl ? 'آخر دخول' : 'Last Login'}</TableHead>
                        <TableHead className={isRtl ? 'text-left' : 'text-right'}>{isRtl ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name || '—'}</TableCell>
                          <TableCell dir="ltr" className="text-sm">{s.email}</TableCell>
                          <TableCell dir="ltr" className="text-sm">{s.phone || '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {s.roles.map((role) => {
                                const info = ROLE_LABELS[role];
                                return (
                                  <div key={role} className="group flex items-center gap-0.5">
                                    <Badge variant="secondary" className={`text-[10px] ${info?.color ?? ''}`}>
                                      {info ? t(info.labelKey) : role}
                                    </Badge>
                                    <button
                                      onClick={() => removeMutation.mutate({ userId: s.id, role: role as RoleKey })}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                                      title={isRtl ? 'إزالة الدور' : 'Remove role'}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(s.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.lastSignedIn
                              ? new Date(s.lastSignedIn).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')
                              : '—'
                            }
                          </TableCell>
                          <TableCell className={isRtl ? 'text-left' : 'text-right'}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(isRtl ? 'هل أنت متأكد من إزالة هذا الموظف؟ سيتم إزالة جميع أدواره.' : 'Remove this staff member? All their roles will be removed.')) {
                                  removeStaffMutation.mutate({ userId: s.id });
                                }
                              }}
                              disabled={removeStaffMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Support Permissions Summary */}
        {roleCounts.some(({ role, count }) => ROLE_LABELS[role]?.group === "Support Permissions" && count > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('admin.roles.supportPerms')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {roleCounts.filter(({ role }) => ROLE_LABELS[role]?.group === "Support Permissions").map(({ role, count }) => (
                  <div
                    key={role}
                    className={`text-center p-3 rounded-lg border cursor-pointer transition-all ${
                      filterRole === role ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
                  >
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{t(ROLE_LABELS[role].labelKey)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
