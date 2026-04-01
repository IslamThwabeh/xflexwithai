import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const STEP_LABELS: Record<string, string> = {
  select_broker: 'Select Broker',
  open_account: 'Open & Verify Account',
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

export interface OnboardingRecordCardProps {
  record: any;
  isExpanded: boolean;
  onToggle: () => void;
  adminNote: string;
  onAdminNoteChange: (value: string) => void;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onApprove: (stepId: number, adminNote?: string) => void;
  onReject: (stepId: number, rejectionReason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AdminOnboardingRecordCard({
  record,
  isExpanded,
  onToggle,
  adminNote,
  onAdminNoteChange,
  rejectReason,
  onRejectReasonChange,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: OnboardingRecordCardProps) {
  return (
    <Card className={`transition-all ${isExpanded ? 'ring-2 ring-emerald-500/30' : ''}`}>
      <CardContent className="p-4">
        {/* Header row */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={onToggle}
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

            {record.aiConfidence != null && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium">AI Verification: {Math.round(record.aiConfidence * 100)}% confidence</p>
                {record.aiResult && <p className="text-xs text-muted-foreground mt-1">{record.aiResult}</p>}
              </div>
            )}

            {record.rejectionReason && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700">Previous Rejection:</p>
                <p className="text-sm text-red-600 mt-1">{record.rejectionReason}</p>
              </div>
            )}

            {record.status === 'pending_review' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Admin Note (optional)</label>
                  <Input
                    value={adminNote}
                    onChange={(e) => onAdminNoteChange(e.target.value)}
                    placeholder="Optional note..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onApprove(record.id, adminNote || undefined)}
                    disabled={isApproving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onReject(record.id, rejectReason)}
                    disabled={isRejecting}
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
                    onChange={(e) => onRejectReasonChange(e.target.value)}
                    placeholder="Explain why the proof was rejected..."
                    rows={2}
                  />
                </div>
              </div>
            )}

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
}
