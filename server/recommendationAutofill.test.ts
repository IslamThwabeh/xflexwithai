import { describe, expect, it } from 'vitest';
import { applyRecommendationAutofill, getMissingRecommendationFields, type RecommendationFormFields } from '../frontend/src/lib/recommendationAutofill';
const old: RecommendationFormFields = { symbol: 'EURUSD', side: 'SELL', entryPrice: '1.08', stopLoss: '1.09', takeProfit1: '1.07', takeProfit2: '1.06', takeProfit3: '', riskPercent: '2%' };
describe('recommendation form autofill', () => {
  it('clears stale values, including optional targets and the old symbol', () => {
    const fields = applyRecommendationAutofill(old, old, { side: 'BUY', entryPrice: '2400' });
    expect(fields.symbol).toBe('');
    expect(fields.takeProfit2).toBe('');
    expect(fields.stopLoss).toBe('');
    expect(getMissingRecommendationFields(fields)).toEqual(['symbol', 'stopLoss', 'takeProfit1']);
  });
  it('preserves manual edits made while parsing, and replaces untouched values', () => {
    const current = { ...old, stopLoss: '2388' };
    const fields = applyRecommendationAutofill(current, old, { symbol: 'XAUUSD', side: 'BUY', entryPrice: '2400', stopLoss: '2390' });
    expect(fields.stopLoss).toBe('2388');
    expect(fields.entryPrice).toBe('2400');
    expect(fields.symbol).toBe('XAUUSD');
  });
});
