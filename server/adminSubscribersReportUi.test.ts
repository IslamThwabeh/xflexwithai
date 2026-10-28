import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clientPaymentExportFields, clientPaymentCoverageLabel, unavailableClientPaymentSummary } from '../shared/clientPaymentSummary';

describe('staff payment display and export contract', () => {
  it('exports confirmed minor-unit evidence and incomplete-history status without rounding', () => {
    const summary = { ...unavailableClientPaymentSummary('2026-10-28T13:00:00.000Z'), coverage: 'needs_reconciliation' as const,
      receiptsMinor: 35001, refundsMinor: 101, netPaidMinor: 34900, receiptCount: 1,
      historicalOrderCount: 1, historicalKeyCount: 2, unusedPaidKeyCount: 1 };
    expect(clientPaymentExportFields(summary)).toEqual(['350.01', '1.01', '349.00', 'needs_reconciliation', 1, 2, 1, '2026-10-28T13:00:00.000Z']);
    expect(clientPaymentCoverageLabel(summary, 'en')).toBe('Historical payments need verification');
    expect(clientPaymentCoverageLabel(summary, 'ar')).toBe('مدفوعات تاريخية تحتاج إلى تحقق');
  });
  it('never turns an old API or failed source into a paid-zero export', () => {
    expect(clientPaymentExportFields(undefined).slice(0, 4)).toEqual(['', '', '', 'unavailable']);
    expect(clientPaymentExportFields(unavailableClientPaymentSummary()).slice(0, 4)).toEqual(['', '', '', 'unavailable']);
  });
  it('uses the common evidence display and exporter in both staff reports', () => {
    for (const page of ['AdminStudents', 'AdminSubscribersReport']) {
      const source = readFileSync(new URL(`../frontend/src/pages/${page}.tsx`, import.meta.url), 'utf8');
      expect(source).toContain('<ClientPaymentSummary');
      expect(source).toContain('clientPaymentExportFields(s.paymentSummary)');
      expect(source).not.toContain('s.totalSpentIls');
      expect(source).not.toContain('s.grossSpentIls');
    }
    const profile = readFileSync(new URL('../frontend/src/components/admin/AdminClientProfileSheet.tsx', import.meta.url), 'utf8');
    expect(profile).toContain('<ClientPaymentSummary summary={profile.paymentSummary}');
    expect(profile).not.toContain('sale.grossIls, 0)');
  });
});
