import DashboardLayout from "@/components/DashboardLayout";
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
import { Shield, UserPlus, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { en: string; color: string; group: string }> = {
  analyst: { en: "Analyst", color: "bg-purple-100 text-purple-800", group: "Core Roles" },
  support: { en: "Support", color: "bg-blue-100 text-blue-800", group: "Core Roles" },
  key_manager: { en: "Key Manager", color: "bg-amber-100 text-amber-800", group: "Core Roles" },
  view_progress: { en: "View Progress", color: "bg-green-100 text-green-800", group: "Support Permissions" },
  view_recommendations: { en: "View Recommendations", color: "bg-pink-100 text-pink-800", group: "Support Permissions" },
  view_subscriptions: { en: "View Subscriptions", color: "bg-cyan-100 text-cyan-800", group: "Support Permissions" },
  view_quizzes: { en: "View Quizzes", color: "bg-orange-100 text-orange-800", group: "Support Permissions" },
  client_lookup: { en: "Client Lookup", color: "bg-indigo-100 text-indigo-800", group: "Support Permissions" },
};

export default function AdminRoles() {
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("analyst");
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");

  const { data: roleAssignments, isLoading, refetch } = trpc.roles.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();

  const assignMutation = trpc.roles.assign.useMutation({
    onSuccess: () => {
      toast.success("Role assigned successfully");
      refetch();
      setShowAssign(false);
      setAssignUserId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.roles.remove.useMutation({
    onSuccess: () => {
      toast.success("Role removed successfully");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredAssignments = (roleAssignments ?? []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.userEmail?.toLowerCase().includes(s) ||
      r.userName?.toLowerCase().includes(s) ||
      r.role.toLowerCase().includes(s)
    );
  });

  // Users not yet assigned the selected role
  const availableUsers = (allUsers ?? []).filter((u) => {
    const alreadyHas = (roleAssignments ?? []).some(
      (r) => r.userId === u.id && r.role === selectedRole
    );
    return !alreadyHas;
  });

  const handleAssign = () => {
    const id = parseInt(assignUserId, 10);
    if (!id) {
      toast.error("Select a user");
      return;
    }
    assignMutation.mutate({
      userId: id,
      role: selectedRole as "analyst" | "support" | "key_manager" | "view_progress" | "view_recommendations" | "view_subscriptions" | "view_quizzes" | "client_lookup",
    });
  };

  // Group by role for summary cards
  const roleCounts = Object.keys(ROLE_LABELS).map((role) => ({
    role,
    count: (roleAssignments ?? []).filter((r) => r.role === role).length,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" /> Role Management
            </h1>
            <p className="text-muted-foreground">
              Assign and manage user roles: Analyst, Support, Key Manager, and support permissions
            </p>
          </div>

          <Dialog open={showAssign} onOpenChange={setShowAssign}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <optgroup label="Core Roles">
                      {Object.entries(ROLE_LABELS).filter(([, v]) => v.group === "Core Roles").map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.en}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Support Permissions">
                      {Object.entries(ROLE_LABELS).filter(([, v]) => v.group === "Support Permissions").map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.en}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">User</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={assignMutation.isPending || !assignUserId}
                  className="w-full"
                >
                  {assignMutation.isPending ? "Assigning..." : "Assign Role"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Role summary cards */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Core Roles</h2>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {roleCounts.filter(({ role }) => ROLE_LABELS[role]?.group === "Core Roles").map(({ role, count }) => (
              <Card key={role}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {ROLE_LABELS[role].en}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">
                    {count === 1 ? "user" : "users"} with this role
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <h2 className="text-lg font-semibold mb-3">Support Permissions</h2>
          <div className="grid gap-4 md:grid-cols-5">
            {roleCounts.filter(({ role }) => ROLE_LABELS[role]?.group === "Support Permissions").map(({ role, count }) => (
              <Card key={role}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {ROLE_LABELS[role].en}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Role assignments table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Role Assignments</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border rounded-md text-sm w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : filteredAssignments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No role assignments found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((r) => (
                    <TableRow key={r.roleId}>
                      <TableCell className="font-medium">
                        {r.userName || "—"}
                      </TableCell>
                      <TableCell>{r.userEmail}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={ROLE_LABELS[r.role]?.color ?? ""}
                        >
                          {ROLE_LABELS[r.role]?.en ?? r.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(r.assignedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() =>
                            removeMutation.mutate({
                              userId: r.userId,
                              role: r.role as "analyst" | "support" | "key_manager" | "view_progress" | "view_recommendations" | "view_subscriptions" | "view_quizzes" | "client_lookup",
                            })
                          }
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
