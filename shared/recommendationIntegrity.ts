export type RecommendationManagementAction = 'cancel_pending' | 'early_close' | 'correction';

/** Structured prices are authoritative; never infer execution mode from prose. */
export function validateRecommendationLevels(input: {
  side?: string | null; entryPrice?: string | null; stopLoss?: string | null;
  takeProfit1?: string | null; takeProfit2?: string | null; takeProfit3?: string | null;
}): string | null {
  const side = input.side?.trim().toUpperCase();
  if (side !== 'BUY' && side !== 'SELL') return 'Choose BUY or SELL.';
  const price = (value?: string | null) => value?.trim() && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  const entry = price(input.entryPrice), sl = price(input.stopLoss), tp = price(input.takeProfit1);
  if (![entry, sl, tp].every(v => Number.isFinite(v) && v > 0)) return 'Enter valid positive entry, stop loss and target 1 prices.';
  const direction = side === 'BUY' ? 1 : -1;
  if ((entry - sl) * direction <= 0 || (tp - entry) * direction <= 0) return 'Stop loss and targets must be on the correct sides of entry.';
  let previous = tp;
  for (const value of [input.takeProfit2, input.takeProfit3]) {
    if (!value?.trim()) continue;
    const next = price(value);
    if (!Number.isFinite(next) || next <= 0 || (next - previous) * direction <= 0) return 'Targets must be valid prices in order beyond target 1.';
    previous = next;
  }
  return null;
}

export function recommendationManagementCopy(action: RecommendationManagementAction) {
  if (action === 'cancel_pending') return {
    titleEn: 'Cancel pending recommendation', titleAr: 'إلغاء التوصية المعلّقة',
    instructionEn: 'Cancel the unfilled pending entry order in your trading application. This notice does not execute any broker action. If your order has already filled, do not treat it as cancelled; review the trade with the academy.',
    instructionAr: 'ألغِ أمر الدخول المعلّق غير المنفّذ في تطبيق التداول. هذا الإشعار لا ينفّذ أي إجراء لدى الوسيط. إذا تفعّل أمرك بالفعل، فلا تعتبر الصفقة ملغاة؛ راجعها مع الأكاديمية.',
  };
  if (action === 'early_close') return {
    titleEn: 'Early-close instruction', titleAr: 'تعليمات إغلاق مبكر',
    instructionEn: 'Close the remaining open position in your trading application. Cancel any unfilled entry orders for this recommendation. This notice does not execute any broker action; your execution price may differ. The trade result remains part of performance.',
    instructionAr: 'أغلق الجزء المتبقي من الصفقة المفتوحة في تطبيق التداول، وألغِ أوامر الدخول غير المنفّذة لهذه التوصية. هذا الإشعار لا ينفّذ أي إجراء لدى الوسيط وقد يختلف سعر تنفيذك. تبقى نتيجة الصفقة ضمن الأداء.',
  };
  return {
    titleEn: 'Recommendation clarification', titleAr: 'توضيح على التوصية',
    instructionEn: 'Read this clarification alongside the original recommendation. The original message and its results remain in history.',
    instructionAr: 'اقرأ هذا التوضيح مع التوصية الأصلية. تبقى الرسالة الأصلية ونتائجها محفوظة في السجل.',
  };
}
