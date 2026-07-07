import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterStep: string;
  onFilterStepChange: (value: string) => void;
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  isAr: boolean;
  showStatus?: boolean;
}

export function AdminOnboardingFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterStep,
  onFilterStepChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  isAr,
  showStatus = true,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder={isAr ? 'ابحث بالاسم أو الإيميل أو الوسيط...' : 'Search by name, email, or broker...'} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
      </div>
      {showStatus && (
        <select value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white">
          <option value="">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="not_started">{isAr ? 'لم يبدأ' : 'Not Started'}</option>
          <option value="pending_review">{isAr ? 'بانتظار المراجعة' : 'Pending Review'}</option>
          <option value="approved">{isAr ? 'تمت الموافقة' : 'Approved'}</option>
          <option value="rejected">{isAr ? 'مرفوض' : 'Rejected'}</option>
        </select>
      )}
      <select value={filterStep} onChange={(e) => onFilterStepChange(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white">
        <option value="">{isAr ? 'كل الخطوات' : 'All Steps'}</option>
        <option value="open_account">{isAr ? 'فتح الحساب وتوثيقه' : 'Open & Verify Account'}</option>
        <option value="deposit">{isAr ? 'الإيداع' : 'Deposit'}</option>
      </select>
      <Input type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} className="w-auto" />
      <Input type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} className="w-auto" />
    </div>
  );
}
