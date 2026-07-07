import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, Download, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTablePagination } from '@/components/DataTable';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type SortKey = 'brokerName' | 'openedAccounts' | 'deposits' | 'conversionRate' | 'pendingProofs' | 'rejectedProofs';

function formatDate(value: string | null | undefined, isRtl: boolean) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminBrokerReportContent() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [search, setSearch] = useState('');
  const [brokerStatus, setBrokerStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState<SortKey>('deposits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [offset, setOffset] = useState(0);

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    brokerStatus,
    fromDate: fromDate || undefined,
    toDate: toDate ? `${toDate} 23:59:59` : undefined,
    sort,
    sortDir,
    limit: pageSize,
    offset,
  }), [brokerStatus, fromDate, offset, pageSize, search, sort, sortDir, toDate]);

  const { data, isLoading } = trpc.onboarding.report.useQuery(filters);

  useEffect(() => {
    setOffset(0);
  }, [search, brokerStatus, fromDate, toDate, sort, sortDir, pageSize]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize);

  const changeSort = (nextSort: SortKey) => {
    if (sort === nextSort) {
      setSortDir((current) => current === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(nextSort);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const rows = data?.rows ?? [];
    const header = [
      'Broker',
      'Status',
      'Opened Accounts',
      'Deposits',
      'Conversion Rate',
      'Pending Proofs',
      'Rejected Proofs',
      'Last Open Approval',
      'Last Deposit Approval',
    ];
    const csv = [
      header.join(','),
      ...rows.map((row) => [
        `"${(isRtl ? row.brokerNameAr : row.brokerNameEn).replace(/"/g, '""')}"`,
        row.isActive ? 'Active' : 'Inactive',
        row.openedAccounts,
        row.deposits,
        `${row.conversionRate}%`,
        row.pendingProofs,
        row.rejectedProofs,
        row.lastOpenedApprovedAt ?? '',
        row.lastDepositApprovedAt ?? '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `broker-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totals = data?.totals;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">{isRtl ? 'تقرير الوسطاء' : 'Broker Report'}</h1>
            <p className="text-sm text-muted-foreground">
              {isRtl
                ? 'الأرقام مبنية على الإثباتات التي تمت الموافقة عليها رسمياً.'
                : 'Counts are based on officially approved onboarding proofs.'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.rows?.length}>
          <Download className="me-2 h-4 w-4" />
          {isRtl ? 'تصدير' : 'Export'}
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={isRtl ? 'فتحوا حساب' : 'Opened Accounts'} value={totals?.openedAccounts ?? 0} />
        <StatCard label={isRtl ? 'أودعوا' : 'Deposited'} value={totals?.deposits ?? 0} />
        <StatCard label={isRtl ? 'بانتظار المراجعة' : 'Pending Proofs'} value={totals?.pendingProofs ?? 0} />
        <StatCard label={isRtl ? 'مرفوضة' : 'Rejected Proofs'} value={totals?.rejectedProofs ?? 0} />
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_150px_150px]">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="ps-9"
                placeholder={isRtl ? 'بحث باسم الوسيط...' : 'Search broker name...'}
              />
            </div>
            <select
              value={brokerStatus}
              onChange={(event) => setBrokerStatus(event.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="all">{isRtl ? 'كل الوسطاء' : 'All brokers'}</option>
              <option value="active">{isRtl ? 'النشطون' : 'Active'}</option>
              <option value="inactive">{isRtl ? 'غير النشطين' : 'Inactive'}</option>
            </select>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <Th label={isRtl ? 'الوسيط' : 'Broker'} sortKey="brokerName" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <Th label={isRtl ? 'فتحوا حساب' : 'Opened'} sortKey="openedAccounts" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <Th label={isRtl ? 'أودعوا' : 'Deposited'} sortKey="deposits" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <Th label={isRtl ? 'نسبة الإيداع' : 'Conversion'} sortKey="conversionRate" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <Th label={isRtl ? 'بانتظار' : 'Pending'} sortKey="pendingProofs" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <Th label={isRtl ? 'مرفوضة' : 'Rejected'} sortKey="rejectedProofs" activeSort={sort} sortDir={sortDir} onSort={changeSort} />
                  <th className="px-4 py-3 text-start">{isRtl ? 'آخر فتح حساب' : 'Last Opened'}</th>
                  <th className="px-4 py-3 text-start">{isRtl ? 'آخر إيداع' : 'Last Deposit'}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{isRtl ? 'جارٍ التحميل...' : 'Loading...'}</td></tr>
                ) : !data?.rows?.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      {isRtl ? 'لا توجد نتائج' : 'No results found'}
                    </td>
                  </tr>
                ) : data.rows.map((row) => (
                  <tr key={row.brokerId} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{isRtl ? row.brokerNameAr : row.brokerNameEn}</div>
                      <Badge variant={row.isActive ? 'default' : 'secondary'} className="mt-1 text-xs">
                        {row.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.openedAccounts}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{row.deposits}</td>
                    <td className="px-4 py-3">{row.conversionRate}%</td>
                    <td className="px-4 py-3 text-amber-700">{row.pendingProofs}</td>
                    <td className="px-4 py-3 text-red-700">{row.rejectedProofs}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.lastOpenedApprovedAt, isRtl)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.lastDepositApprovedAt, isRtl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalItems={total}
              setPage={(nextPage) => setOffset(nextPage * pageSize)}
              changePageSize={(nextSize) => {
                setPageSize(PAGE_SIZE_OPTIONS.includes(nextSize as any) ? nextSize : 25);
                setOffset(0);
              }}
              isRtl={isRtl}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Th({
  label,
  sortKey,
  activeSort,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (sort: SortKey) => void;
}) {
  const active = activeSort === sortKey;
  return (
    <th className="px-4 py-3 text-start">
      <button type="button" onClick={() => onSort(sortKey)} className="font-semibold hover:text-slate-900">
        {label}{active ? (sortDir === 'desc' ? ' v' : ' ^') : ''}
      </button>
    </th>
  );
}
