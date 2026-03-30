import { useState } from 'react';
import { FileCheck, CheckCircle2, XCircle, Clock, Eye, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const STEP_LABELS: Record<string, string> = {
  select_broker: 'Select Broker',
  open_account: 'Open Account',
  verify_account: 'Verify Account',
  deposit: 'Deposit',
};

function statusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-emerald-100 text-emerald-700';
    case 'pending_review': return 'bg-amber-100 text-amber-700';
    case 'rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'approved': return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'pending_review': return <Clock className="h-3.5 w-3.5" />;
    case 'rejected': return <XCircle className="h-3.5 w-3.5" />;
    default: return null;
  }
}

export default function AdminBrokerOnboarding() {
  return (
    <DashboardLayout>
      <AdminBrokerOnboardingContent />
    </DashboardLayout>
  );
}

export function AdminBrokerOnboardingContent() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStep, setFilterStep] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const { data: pendingProofs = [], isLoading: pendingLoading } = trpc.onboarding.pendingProofs.useQuery(
    undefined, { enabled: tab === 'pending' }
  );
  const { data: allRecords = [], isLoading: allLoading } = trpc.onboarding.allRecords.useQuery(
    filterStatus || filterStep ? { status: filterStatus || undefined, step: filterStep || undefined } : undefined,
    { enabled: tab === 'all' }
  );

  const approveMutation = trpc.onboarding.approve.useMutation({
    onSuccess: () => {
      toast.success('Step approved');
      utils.onboarding.pendingProofs.invalidate();
      utils.onboarding.allRecords.invalidate();
      setExpandedId(null);
      setAdminNote('');
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.onboarding.reject.useMutation({
    onSuccess: () => {
      toast.success('Step rejected');
      utils.onboarding.pendingProofs.invalidate();
      utils.onboarding.allRecords.invalidate();
      setExpandedId(null);
      setRejectReason('');
    },
    onError: (e) => toast.error(e.message),
  });

  const records = tab === 'pending' ? pendingProofs : allRecords;
  const isLoading = tab === 'pending' ? pendingLoading : allLoading;

  const filteredRecords = searchQuery
    ? records.filter((r: any) =>
        (r.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.brokerName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : records;

  return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileCheck className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold">
            {isAr ? 'مراجعة تسجيل الوسطاء' : 'Broker Onboarding Review'}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('pending')}
          >
            <Clock className="h-4 w-4 mr-1" />
            {isAr ? 'بانتظار المراجعة' : 'Pending Review'}
            {pendingProofs.length > 0 && (
              <Badge className="ms-2 bg-amber-500 text-white text-xs">{pendingProofs.length}</Badge>
            )}
          </Button>
          <Button
            variant={tab === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('all')}
          >
            {isAr ? 'جميع السجلات' : 'All Records'}
          </Button>
        </div>

        {/* Filters for All tab */}
        {tab === 'all' && (
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={isAr ? 'ابحث بالاسم أو الإيميل...' : 'Search by name or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filterStep}
              onChange={(e) => setFilterStep(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">All Steps</option>
              <option value="open_account">Open Account</option>
              <option value="verify_account">Verify Account</option>
              <option value="deposit">Deposit</option>
            </select>
          </div>
        )}

        {/* Records list */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>{tab === 'pending'
                ? (isAr ? 'لا توجد إثباتات بانتظار المراجعة' : 'No pending proofs to review')
                : (isAr ? 'لا توجد سجلات' : 'No records found')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record: any) => {
              const isExpanded = expandedId === record.id;
              return (
                <Card key={record.id} className={`transition-all ${isExpanded ? 'ring-2 ring-emerald-500/30' : ''}`}>
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{record.userName}</span>
                          <span className="text-xs text-muted-foreground truncate">{record.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {STEP_LABELS[record.step] || record.step}
                          </Badge>
                          <Badge className={`text-xs ${statusColor(record.status)}`}>
                            {statusIcon(record.status)}
                            <span className="ms-1">{record.status.replace('_', ' ')}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">{record.brokerName}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {record.submittedAt ? new Date(record.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Proof image */}
                        {record.proofUrl && (
                          <div>
                            <p className="text-sm font-medium mb-2">Proof Screenshot:</p>
                            <img
                              src={record.proofUrl}
                              alt="proof"
                              className="max-w-[300px] max-h-[200px] object-contain rounded-lg border cursor-pointer"
                              onClick={() => window.open(record.proofUrl, '_blank')}
                            />
                          </div>
                        )}

                        {/* AI result if any */}
                        {record.aiConfidence != null && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium">AI Verification: {Math.round(record.aiConfidence * 100)}% confidence</p>
                            {record.aiResult && <p className="text-xs text-muted-foreground mt-1">{record.aiResult}</p>}
                          </div>
                        )}

                        {/* Previous rejection reason */}
                        {record.rejectionReason && (
                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-sm font-medium text-red-700">Previous Rejection:</p>
                            <p className="text-sm text-red-600 mt-1">{record.rejectionReason}</p>
                          </div>
                        )}

                        {/* Action buttons for pending */}
                        {record.status === 'pending_review' && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium block mb-1">Admin Note (optional)</label>
                              <Input
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="Optional note..."
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => approveMutation.mutate({ stepId: record.id, adminNote: adminNote || undefined })}
                                disabled={approveMutation.isPending}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  if (!rejectReason.trim()) {
                                    toast.error('Please enter a rejection reason');
                                    return;
                                  }
                                  rejectMutation.mutate({ stepId: record.id, rejectionReason: rejectReason });
                                }}
                                disabled={rejectMutation.isPending}
                                className="flex-1"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                            <div>
                              <label className="text-sm font-medium block mb-1">Rejection Reason (required to reject)</label>
                              <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why the proof was rejected..."
                                rows={2}
                              />
                            </div>
                          </div>
                        )}

                        {/* Review info for already reviewed */}
                        {record.reviewedAt && (
                          <p className="text-xs text-muted-foreground">
                            Reviewed: {new Date(record.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {record.adminNote && ` — Note: ${record.adminNote}`}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );
}
