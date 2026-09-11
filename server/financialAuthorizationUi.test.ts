import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROLE_PAGE_ACCESS } from '../shared/const';

const rolesSource = readFileSync(new URL('../frontend/src/pages/AdminRoles.tsx', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../frontend/src/pages/AdminOrders.tsx', import.meta.url), 'utf8');
const expensesSource = readFileSync(new URL('../frontend/src/pages/AdminExpenses.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../frontend/src/pages/AdminFinancialDashboard.tsx', import.meta.url), 'utf8');
const activationSource = readFileSync(new URL('../frontend/src/pages/AdminRevenueReport.tsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../frontend/src/pages/AdminFinancialControls.tsx', import.meta.url), 'utf8');
const reconciliationSource = readFileSync(new URL('../frontend/src/pages/AdminFinancialReconciliation.tsx', import.meta.url), 'utf8');
const printSource = readFileSync(new URL('../frontend/src/lib/printReport.ts', import.meta.url), 'utf8');

describe('financial authorization UI contracts', () => {
  it('shows finance-role controls only after server-derived owner authority', () => {
    expect(rolesSource).toContain('trpc.roles.myFinanceAuthority.useQuery()');
    expect(rolesSource).toContain("financeAuthority?.isFinanceOwner === true");
    expect(rolesSource).toContain("const FINANCE_ROLE_KEYS");
    expect(rolesSource).not.toContain("finance_owner: {");
  });

  it('separates financial confirmation controls from operational order controls', () => {
    expect(ordersSource).toContain("staffRoles.includes('finance_manager')");
    expect(ordersSource).toContain("staffRoles.includes('key_manager')");
    expect(ordersSource).toContain('canConfirmPayment &&');
    expect(ordersSource).toContain('canManageOperationalOrders &&');
    expect(ROLE_PAGE_ACCESS.finance_manager).toEqual(['/admin/orders', '/admin/finance', '/admin/finance/expenses', '/admin/finance/controls', '/admin/finance/reconciliation']);
    expect(ROLE_PAGE_ACCESS.finance_clerk).toEqual(['/admin/finance/expenses']);
    expect(ROLE_PAGE_ACCESS.finance_viewer).toEqual(['/admin/finance']);
  });

  it('keeps the expense workflow simple, ILS-only, and without deletion controls', () => {
    expect(expensesSource).toContain("trpc.financeExpenses.createDraft.useMutation");
    expect(expensesSource).toContain("trpc.financeExpenses.submit.useMutation");
    expect(expensesSource).toContain("trpc.financeExpenses.review.useMutation");
    expect(expensesSource).toContain("Amount (₪)");
    expect(expensesSource).toContain("VAT % (informational only)");
    expect(expensesSource).not.toMatch(/deleteExpense|removeExpense/);
  });

  it('loads the financial dashboard only on demand and exports the loaded filter totals', () => {
    expect(dashboardSource).toContain('trpc.financialReports.dashboard.useQuery(filters');
    expect(dashboardSource).toContain('refetchOnWindowFocus: false');
    expect(dashboardSource).toContain('refetchOnMount: false');
    expect(dashboardSource).not.toContain('refetchInterval');
    expect(dashboardSource).toContain('data.periods.map');
    expect(dashboardSource).toContain('data.totals.confirmedIncomeMinor');
    expect(dashboardSource).toContain('data.totals.operatingProfitLossMinor');
    expect(dashboardSource).toContain("printReport(isRtl ? 'تقرير الأرباح والخسائر الإداري'");
    expect(dashboardSource).toContain('className="no-print rounded-2xl');
    expect(dashboardSource).toContain('print-title');
    expect(printSource).toContain('[data-slot="sidebar-gap"]');
    expect(printSource).toContain('[data-slot="sidebar-container"]');
  });

  it('labels activation as operational activity and never as revenue', () => {
    expect(activationSource).toContain('trpc.reports.activationActivity.useQuery');
    expect(activationSource).toMatch(/not a revenue report/i);
    expect(activationSource).not.toContain('Gross Sales');
    expect(activationSource).not.toContain('Net Revenue');
    expect(activationSource).not.toContain('Total Revenue');
  });

  it('keeps corrections append-only and financial controls free of polling or deletion', () => {
    expect(controlsSource).toContain('trpc.financialControls.createAdjustment.useMutation');
    expect(controlsSource).toContain('trpc.financialControls.reverseEntry.useMutation');
    expect(controlsSource).toContain('trpc.financialControls.setPeriodLock.useMutation');
    expect(controlsSource).toContain('Nothing is silently deleted or rewritten');
    expect(controlsSource).not.toContain('refetchInterval');
    expect(controlsSource).not.toMatch(/deleteAdjustment|deleteEntry/);
  });

  it('keeps historic source records read-only and owner decisions explicit', () => {
    expect(reconciliationSource).toContain('trpc.financialReconciliation.preview.useQuery');
    expect(reconciliationSource).toContain('trpc.financialReconciliation.materializeQueue.useMutation');
    expect(reconciliationSource).toContain('trpc.financialReconciliation.updateDraft.useMutation');
    expect(reconciliationSource).toContain('trpc.financialReconciliation.resolveItem.useMutation');
    expect(reconciliationSource).toContain('Original orders and keys stay read-only and are never changed');
    expect(reconciliationSource).not.toContain('refetchInterval');
    expect(reconciliationSource).not.toMatch(/deleteOrder|deleteKey|updateOrder|updateKey/);
  });
});
