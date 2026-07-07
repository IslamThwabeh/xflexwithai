import { useState } from 'react';
import { FileCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTablePagination } from '@/components/DataTable';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';
import { AdminOnboardingRecordCard } from './AdminOnboardingRecordCard';
import { AdminOnboardingFilters } from './AdminOnboardingFilters';
import { useEffect, useMemo } from 'react';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const queryInput = useMemo(() => ({
    status: tab === 'pending' ? 'pending_review' as const : (filterStatus || undefined) as any,
    step: (filterStep || undefined) as any,
    search: searchQuery.trim() || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate ? `${toDate} 23:59:59` : undefined,
    limit: pageSize,
    offset,
  }), [filterStatus, filterStep, fromDate, offset, pageSize, searchQuery, tab, toDate]);
  const { data: recordsPage, isLoading } = trpc.onboarding.recordsPage.useQuery(queryInput);
  const { data: pendingCountPage } = trpc.onboarding.recordsPage.useQuery({ status: 'pending_review', limit: 1, offset: 0 });

  useEffect(() => {
    setOffset(0);
    setExpandedId(null);
  }, [tab, filterStatus, filterStep, searchQuery, fromDate, toDate, pageSize]);

  const invalidateAll = () => {
    utils.onboarding.pendingProofs.invalidate();
    utils.onboarding.allRecords.invalidate();
    utils.onboarding.recordsPage.invalidate();
    utils.onboarding.report.invalidate();
  };
  const approveMutation = trpc.onboarding.approve.useMutation({
    onSuccess: () => { toast.success(isAr ? 'تمت الموافقة على الخطوة' : 'Step approved'); invalidateAll(); setExpandedId(null); setAdminNote(''); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.onboarding.reject.useMutation({
    onSuccess: () => { toast.success(isAr ? 'تم رفض الخطوة' : 'Step rejected'); invalidateAll(); setExpandedId(null); setRejectReason(''); },
    onError: (e) => toast.error(e.message),
  });

  const records = recordsPage?.rows ?? [];
  const total = recordsPage?.total ?? 0;
  const page = Math.floor(offset / pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleApprove = (stepId: number, note?: string) => approveMutation.mutate({ stepId, adminNote: note });
  const handleReject = (stepId: number, rejectionReason: string) => {
    if (!rejectionReason.trim()) { toast.error(isAr ? 'يرجى إدخال سبب الرفض' : 'Please enter a rejection reason'); return; }
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
          {(pendingCountPage?.total ?? 0) > 0 && <Badge className="ms-2 bg-amber-500 text-white text-xs">{pendingCountPage?.total}</Badge>}
        </Button>
        <Button variant={tab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTab('all')}>
          {isAr ? 'جميع السجلات' : 'All Records'}
        </Button>
      </div>
      <div className="mb-4">
        <AdminOnboardingFilters searchQuery={searchQuery} onSearchChange={setSearchQuery}
          filterStatus={filterStatus} onFilterStatusChange={setFilterStatus}
          filterStep={filterStep} onFilterStepChange={setFilterStep}
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          isAr={isAr} showStatus={tab === 'all'} />
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : records.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{tab === 'pending' ? (isAr ? 'لا توجد إثباتات بانتظار المراجعة' : 'No pending proofs to review') : (isAr ? 'لا توجد سجلات' : 'No records found')}</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-3">
            {records.map((record: any) => (
              <AdminOnboardingRecordCard key={record.id} record={record}
                isExpanded={expandedId === record.id}
                onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                adminNote={adminNote} onAdminNoteChange={setAdminNote}
                rejectReason={rejectReason} onRejectReasonChange={setRejectReason}
                onApprove={handleApprove} onReject={handleReject}
                isApproving={approveMutation.isPending} isRejecting={rejectMutation.isPending} />
            ))}
          </div>
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={total}
            setPage={(nextPage) => setOffset(nextPage * pageSize)}
            changePageSize={(nextSize) => {
              setPageSize(nextSize);
              setOffset(0);
            }}
            isRtl={isAr}
          />
        </>
      )}
    </div>
  );
}
