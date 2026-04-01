import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterStep: string;
  onFilterStepChange: (value: string) => void;
  isAr: boolean;
}

export function AdminOnboardingFilters({ searchQuery, onSearchChange, filterStatus, onFilterStatusChange, filterStep, onFilterStepChange, isAr }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder={isAr ? 'ابحث بالاسم أو الإيميل...' : 'Search by name or email...'} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
      </div>
      <select value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white">
        <option value="">All Statuses</option>
        <option value="not_started">Not Started</option>
        <option value="pending_review">Pending Review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <select value={filterStep} onChange={(e) => onFilterStepChange(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white">
        <option value="">All Steps</option>
        <option value="open_account">Open & Verify Account</option>
        <option value="deposit">Deposit</option>
      </select>
    </div>
  );
}
