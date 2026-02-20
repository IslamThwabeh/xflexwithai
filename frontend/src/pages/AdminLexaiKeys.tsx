import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Download,
  Copy,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function AdminLexaiKeys() {
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const { data: allKeys, refetch: refetchKeys } = trpc.lexaiAdmin.keys.list.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.lexaiAdmin.keys.stats.useQuery();

  const generateKey = trpc.lexaiAdmin.keys.generateKey.useMutation({
    onSuccess: () => {
      toast.success("LexAI key generated successfully!");
      setShowGenerateDialog(false);
      setNotes("");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generateBulkKeys = trpc.lexaiAdmin.keys.generateBulkKeys.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} LexAI keys generated successfully!`);
      setShowBulkDialog(false);
      setQuantity("1");
      setNotes("");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deactivateKey = trpc.lexaiAdmin.keys.deactivateKey.useMutation({
    onSuccess: () => {
      toast.success("Key deactivated successfully");
      refetchKeys();
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleGenerateSingle = () => {
    generateKey.mutate({ notes: notes || undefined });
  };

  const handleGenerateBulk = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast.error("Quantity must be between 1 and 1000");
      return;
    }
    generateBulkKeys.mutate({ quantity: qty, notes: notes || undefined });
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
      ["Key Code", "Email", "Status", "Created At", "Activated At", "Notes"],
      ...allKeys.map((key) => [
        key.keyCode,
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
    a.download = `lexai-keys-${new Date().toISOString().split("T")[0]}.csv`;
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
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">LexAI Keys</h1>
          <p className="text-muted-foreground">Generate manual keys for LexAI access</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Generate Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Single Key</DialogTitle>
                <DialogDescription>Create a new LexAI access key</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this key..."
                  />
                </div>
                <Button
                  onClick={handleGenerateSingle}
                  disabled={generateKey.isPending}
                  className="w-full"
                >
                  {generateKey.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Bulk Generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Bulk Keys</DialogTitle>
                <DialogDescription>Create multiple LexAI keys at once (max 1000)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                    type="number"
                    min={1}
                    max={1000}
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about these keys..."
                  />
                </div>
                <Button
                  onClick={handleGenerateBulk}
                  disabled={generateBulkKeys.isPending}
                  className="w-full"
                >
                  {generateBulkKeys.isPending ? "Generating..." : "Generate Keys"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={exportKeysToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activated}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Unused</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unused}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deactivated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.deactivated}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
          <CardDescription>Manage LexAI keys for users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {!filteredKeys || filteredKeys.length === 0 ? (
            <p className="text-muted-foreground">No keys found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys.map((key) => {
                  const isUsed = !!key.activatedAt;
                  const statusLabel = !key.isActive
                    ? "Deactivated"
                    : isUsed
                      ? "Used"
                      : "Available";

                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-sm">
                        {key.keyCode}
                      </TableCell>
                      <TableCell>{key.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusLabel === "Available" ? "default" : "secondary"}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{key.notes || "-"}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(key.keyCode)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deactivateKey.mutate({ keyId: key.id })}
                          disabled={!key.isActive}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
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
  );
}
