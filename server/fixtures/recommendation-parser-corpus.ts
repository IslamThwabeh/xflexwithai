import type { RecommendationParsedFields } from '../../backend/services/recommendation-parser.service';

export type ParserBenchmarkCase = {
  id: string;
  category: string;
  text: string;
  expected: RecommendationParsedFields;
};

// Synthetic examples with independently specified expected fields. These are
// format coverage, not a sample of customer traffic or a live AI evaluation.
export const recommendationParserCorpus: ParserBenchmarkCase[] = [];

for (const side of ['BUY', 'SELL'] as const) {
  const arSide = side === 'BUY' ? 'شراء' : 'بيع';
  const stop = side === 'BUY' ? '2390' : '2410';
  const targets = side === 'BUY' ? ['2410', '2420', '2430'] : ['2390', '2380', '2370'];
  const expected: RecommendationParsedFields = {
    symbol: 'XAUUSD', side, entryPrice: '2400', stopLoss: stop,
    takeProfit1: targets[0], takeProfit2: targets[1], takeProfit3: targets[2], riskPercent: '1%',
  };
  const levels = `SL ${stop}\nTP1 ${targets[0]}\nTP2 ${targets[1]}\nTP3 ${targets[2]}\nRisk 1%`;
  const arabicLevels = `وقف الخسارة ${stop}\nالهدف 1 ${targets[0]}\nالهدف 2 ${targets[1]}\nالهدف 3 ${targets[2]}\nالمخاطرة 1%`;
  const toArabicDigits = (text: string) => text.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
  const toPersianDigits = (text: string) => text.replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  const formats: Array<[string, string, string]> = [
    ['english-lines', 'standard', `XAUUSD ${side}\nEntry 2400\n${levels}`],
    ['compact', 'standard', `XAUUSD ${side} 2400 / ${levels.replace(/\n/g, ' / ')}`],
    ['tagged-symbol', 'standard', `Symbol: XAU/USD\n${side} 2400\n${levels}`],
    ['crlf', 'standard', `XAUUSD\n${side}\nEntry: 2400\n${levels}`.replace(/\n/g, '\r\n')],
    ['arabic-side', 'arabic', `XAUUSD ${arSide} 2400\n${arabicLevels}`],
    ['arabic-entry', 'arabic', `XAUUSD\n${side}\nسعر الدخول 2400\n${arabicLevels}`],
    ['arabic-ordinal-targets', 'arabic', `XAUUSD ${side} 2400\nوقف الخسارة ${stop}\nالهدف الأول ${targets[0]}\nالهدف الثاني ${targets[1]}\nالهدف الثالث ${targets[2]}\nالمخاطرة 1%`],
    ['arabic-digits', 'unicode-numbers', toArabicDigits(`XAUUSD ${side} 2400\n${arabicLevels}`)],
    ['persian-digits', 'unicode-numbers', toPersianDigits(`XAUUSD ${side} 2400\n${levels}`)],
    ['side-first', 'symbol-position', `${side} XAUUSD 2400\n${levels}`],
    ['lowercase', 'symbol-position', `xauusd ${side.toLowerCase()} 2400\n${levels}`],
    ['hashtag', 'symbol-position', `#XAUUSD ${side} 2400\n${levels}`],
    ['emoji-labels', 'punctuation', `🟡 XAUUSD ${side}\nEntry 🎯 2400\nSL 🛑 ${stop}\nTP1 ✅ ${targets[0]}\nTP2 ✅ ${targets[1]}\nTP3 ✅ ${targets[2]}\nRisk ⚠️ 1%`],
    ['equals-and-colons', 'punctuation', `XAUUSD ${side}: 2400\nSL = ${stop}\nTP1: ${targets[0]}\nTP2 = ${targets[1]}\nTP3: ${targets[2]}\nRisk: 1%`],
    ['parenthesized-targets', 'punctuation', `XAUUSD ${side} 2400\nSL ${stop}\nTP(1) ${targets[0]}\nTP(2) ${targets[1]}\nTP(3) ${targets[2]}\nRisk 1%`],
    ['decimal-comma', 'unicode-numbers', `XAUUSD ${side} 2400,00\nSL ${stop},00\nTP1 ${targets[0]},00\nTP2 ${targets[1]},00\nTP3 ${targets[2]},00\nRisk 1%`],
    ['thousands-separator', 'unicode-numbers', `XAUUSD ${side} 2,400.00\nSL ${stop[0]},${stop.slice(1)}.00\nTP1 ${targets[0][0]},${targets[0].slice(1)}.00\nTP2 ${targets[1][0]},${targets[1].slice(1)}.00\nTP3 ${targets[2][0]},${targets[2].slice(1)}.00\nRisk 1%`],
    ['entry-after-levels', 'entry-selection', `XAUUSD ${side} SL ${stop} TP1 ${targets[0]} TP2 ${targets[1]} TP3 ${targets[2]} Entry 2400 Risk 1%`],
    ['arabic-decimal-separator', 'unicode-numbers', toArabicDigits(`XAUUSD ${side} 2400٫00\nSL ${stop}٫00\nTP1 ${targets[0]}٫00\nTP2 ${targets[1]}٫00\nTP3 ${targets[2]}٫00\nRisk 1٪`)],
    ['bidi-marks', 'punctuation', `\u200fXAUUSD ${side}\nEntry \u200e2400\nSL \u200e${stop}\nTP1 \u200e${targets[0]}\nTP2 \u200e${targets[1]}\nTP3 \u200e${targets[2]}\nRisk \u200e1%`],
  ];
  formats.push(
    ['reversed-target-mixed', 'reversed-target', 'XAUUSD\n\n' + side + ' NOW 2400\n\nSL: ' + stop + '\n\n' + targets[0] + ' :TP1\nTP2: ' + targets[1] + '\n' + targets[2] + ' :TP3\nRisk 1%'],
    ['reversed-target-lines', 'reversed-target', 'XAUUSD ' + side + ' 2400\nSL ' + stop + '\n' + targets[0] + ' :TP1\n' + targets[1] + ' :TP2\n' + targets[2] + ' :TP3\nRisk 1%'],
    ['reversed-target-inline', 'reversed-target', 'XAUUSD ' + side + ' 2400 / SL ' + stop + ' / ' + targets[0] + ' :TP1 / ' + targets[1] + ' = TP2 / ' + targets[2] + ' : TP(3) / Risk 1%'],
    ['reversed-target-arabic-digits', 'reversed-target', toArabicDigits('XAUUSD ' + arSide + ' 2400\nوقف الخسارة ' + stop + '\n' + targets[0] + ' :TP1\n' + targets[1] + ' :TP2\n' + targets[2] + ' :TP3\nالمخاطرة 1%')],
    ['reversed-target-arabic-labels', 'reversed-target', 'XAUUSD ' + side + ' 2400\nSL ' + stop + '\n' + targets[0] + ' :الهدف الأول\n' + targets[1] + ' = الهدف الثاني\n' + targets[2] + ' :الهدف الثالث\nRisk 1%'],
  );
  for (const [format, category, text] of formats) {
    recommendationParserCorpus.push({ id: `${format}-${side.toLowerCase()}`, category, text, expected: { ...expected } });
  }
}

recommendationParserCorpus.push(
  { id: 'missing-entry', category: 'absent-fields', text: 'XAUUSD BUY SL 2390 TP1 2410', expected: { symbol: 'XAUUSD', side: 'BUY', stopLoss: '2390', takeProfit1: '2410' } },
  { id: 'missing-symbol', category: 'absent-fields', text: 'BUY 2400\nSL 2390\nTP1 2410', expected: { side: 'BUY', entryPrice: '2400', stopLoss: '2390', takeProfit1: '2410' } },
  { id: 'missing-side', category: 'absent-fields', text: 'XAUUSD\nEntry 2400\nSL 2390\nTP1 2410', expected: { symbol: 'XAUUSD', entryPrice: '2400', stopLoss: '2390', takeProfit1: '2410' } },
  { id: 'prose-only', category: 'absent-fields', text: 'Please wait for the next recommendation.', expected: {} },
  { id: 'symbol-only', category: 'absent-fields', text: 'XAUUSD', expected: { symbol: 'XAUUSD' } },
  { id: 'forex-pair', category: 'other-symbols', text: 'EUR/USD SELL 1.0830\nSL 1.0870\nTP1 1.0790\nTP2 1.0760\nRisk 0.5%', expected: { symbol: 'EURUSD', side: 'SELL', entryPrice: '1.0830', stopLoss: '1.0870', takeProfit1: '1.0790', takeProfit2: '1.0760', riskPercent: '0.5%' } },
  { id: 'index-digits', category: 'other-symbols', text: 'US30 BUY 42000\nSL 41900\nTP1 42100', expected: { symbol: 'US30', side: 'BUY', entryPrice: '42000', stopLoss: '41900', takeProfit1: '42100' } },
  { id: 'crypto', category: 'other-symbols', text: 'BTCUSD BUY 70000\nSL 69000\nTP1 71000', expected: { symbol: 'BTCUSD', side: 'BUY', entryPrice: '70000', stopLoss: '69000', takeProfit1: '71000' } },
);
