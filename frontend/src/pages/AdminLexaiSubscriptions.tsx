import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
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

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">LexAI Subscriptions</h1>
        <p className="text-muted-foreground">Monitor active and expired LexAI plans</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <p className="text-muted-foreground">No subscriptions found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const endDate = sub.endDate ? new Date(sub.endDate) : null;
                  const isValidEndDate = endDate ? !Number.isNaN(endDate.getTime()) : false;
                  const isExpired = isValidEndDate && endDate ? endDate.getTime() < Date.now() : false;
                  const statusLabel = sub.isActive && !isExpired ? "Active" : "Expired";

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.userName || "Unknown"}</TableCell>
                      <TableCell>{sub.userEmail || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusLabel === "Active" ? "default" : "secondary"}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.messagesUsed} / {sub.messagesLimit}
                      </TableCell>
                      <TableCell>
                        {formatSafeDate(sub.endDate, "MMM d, yyyy")}
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
