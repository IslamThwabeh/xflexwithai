import { useState } from 'react';
import { FileCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';
import { AdminOnboardingRecordCard } from './AdminOnboardingRecordCard';
import { AdminOnboardingFilters } from './AdminOnboardingFilters';

export default function AdminBrokerOnboarding() {
  return (<DashboardLayout><AdminBrokerOnboardingContent /></DashboardLayout>);
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

  const invalidateAll = () => { utils.onboarding.pendingProofs.invalidate(); utils.onboarding.allRecords.invalidate(); };
  const approveMutation = trpc.onboarding.approve.useMutation({
    onSuccess: () => { toast.success('Step approved'); invalidateAll(); setExpandedId(null); setAdminNote(''); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.onboarding.reject.useMutation({
    onSuccess: () => { toast.success('Step rejected'); invalidateAll(); setExpandedId(null); setRejectReason(''); },
    onError: (e) => toast.error(e.message),
  });

  const records = tab === 'pending' ? pendingProofs : allRecords;
  const isLoading = tab === 'pending' ? pendingLoading : allLoading;
  const filteredRecords = searchQuery
    ? records.filter((r: any) =>
        (r.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.brokerName || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : records;

  const handleApprove = (stepId: number, note?: string) => approveMutation.mutate({ stepId, adminNote: note });
  const handleReject = (stepId: number, rejectionReason: string) => {
    if (!rejectionReason.trim()) { toast.error('Please enter a rejection reason'); return; }
    rejectMutation.mutate({ stepId, rejectionReason });
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileCheck className="w-7 h-7 text-emerald-600" />
        <h1 className="text-2xl font-bold">{isAr ? 'مراجعة تسجيل الوسطاء' : 'Broker Onboarding Review'}</h1>
      </div>
      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setTab('pending')}>
          <Clock className="h-4 w-4 mr-1" />
          {isAr ? 'بانتظار المراجعة' : 'Pending Review'}
          {pendingProofs.length > 0 && <Badge className="ms-2 bg-amber-500 text-white text-xs">{pendingProofs.length}</Badge>}
        </Button>
        <Button variant={tab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTab('all')}>
          {isAr ? 'جميع السجلات' : 'All Records'}
        </Button>
      </div>
      {tab === 'all' && (
        <AdminOnboardingFilters searchQuery={searchQuery} onSearchChange={setSearchQuery}
          filterStatus={filterStatus} onFilterStatusChange={setFilterStatus}
          filterStep={filterStep} onFilterStepChange={setFilterStep} isAr={isAr} />
      )}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredRecords.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{tab === 'pending' ? (isAr ? 'لا توجد إثباتات بانتظار المراجعة' : 'No pending proofs to review') : (isAr ? 'لا توجد سجلات' : 'No records found')}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record: any) => (
            <AdminOnboardingRecordCard key={record.id} record={record}
              isExpanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
              adminNote={adminNote} onAdminNoteChange={setAdminNote}
              rejectReason={rejectReason} onRejectReasonChange={setRejectReason}
              onApprove={handleApprove} onReject={handleReject}
              isApproving={approveMutation.isPending} isRejecting={rejectMutation.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}
