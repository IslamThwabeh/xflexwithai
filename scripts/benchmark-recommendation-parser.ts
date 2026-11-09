import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { recommendationParserCorpus } from '../server/fixtures/recommendation-parser-corpus';
import type { RecommendationParsedFields } from '../backend/services/recommendation-parser.service';

// Always offline: never charge the API or send synthetic messages to it.
process.env.OPENAI_API_KEY = '';
const { parseRecommendationDraft } = await import('../backend/services/recommendation-parser.service');
const fieldNames = ['symbol', 'side', 'entryPrice', 'stopLoss', 'takeProfit1', 'takeProfit2', 'takeProfit3', 'riskPercent'] as const;
const equivalent = (field: keyof RecommendationParsedFields, actual?: string, expected?: string) => {
  if (actual === undefined || expected === undefined) return actual === expected;
  if (field === 'symbol' || field === 'side') return actual === expected;
  return Number(actual.replace(/%$/, '')) === Number(expected.replace(/%$/, ''));
};
const results = [];
for (const sample of recommendationParserCorpus) {
  const actual = await parseRecommendationDraft(sample.text);
  const mismatches = fieldNames.filter(field => !equivalent(field, actual.fields[field], sample.expected[field]));
  results.push({ ...sample, actual: actual.fields, parser: actual.parser, passed: mismatches.length === 0, mismatches });
}
const passed = results.filter(result => result.passed).length;
const expectedFields = results.reduce((sum, result) => sum + Object.keys(result.expected).length, 0);
const correctExpectedFields = results.reduce((sum, result) => sum + fieldNames.filter(field => result.expected[field] !== undefined && equivalent(field, result.actual[field], result.expected[field])).length, 0);
const unexpectedFields = results.reduce((sum, result) => sum + fieldNames.filter(field => result.expected[field] === undefined && result.actual[field] !== undefined).length, 0);
const categories = [...new Set(results.map(result => result.category))].map(category => {
  const group = results.filter(result => result.category === category);
  return { category, total: group.length, passed: group.filter(result => result.passed).length };
});
const summary = {
  mode: 'offline rules only; AI key deliberately disabled',
  limitation: 'Synthetic format coverage; not production accuracy. Numeric formatting is compared by value; absent fields must stay absent.',
  total: results.length, passed, exactRecommendationPercent: Number((100 * passed / results.length).toFixed(1)),
  expectedFields, correctExpectedFields, expectedFieldPercent: Number((100 * correctExpectedFields / expectedFields).toFixed(1)),
  unexpectedFields, categories,
  failedAtHighConfidence: results.filter(result => !result.passed && result.parser.confidence >= 0.75).length,
  fields: fieldNames.map(field => ({ field, expected: results.filter(result => result.expected[field] !== undefined).length, correct: results.filter(result => result.expected[field] !== undefined && equivalent(field, result.actual[field], result.expected[field])).length })),
};
const outputDirectory = resolve('output/recommendation-parser-benchmark');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'results.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
writeFileSync(resolve(outputDirectory, 'report.md'), [
  '# Recommendation parser offline benchmark', '',
  `Complete recommendations: **${passed}/${results.length} (${summary.exactRecommendationPercent}%)**.`,
  `Correct expected fields: **${correctExpectedFields}/${expectedFields} (${summary.expectedFieldPercent}%)**. Unexpected fields: **${unexpectedFields}**.`,
  '', summary.mode, '', summary.limitation, '',
  '| Category | Complete recommendations |', '| --- | --- |',
  ...categories.map(group => `| ${group.category} | ${group.passed}/${group.total} |`), '',
  '| Case | Result | Incorrect or missing fields | Score |', '| --- | --- | --- | --- |',
  ...results.map(result => `| ${result.id} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.mismatches.join(', ') || '—'} | ${Math.round(result.parser.confidence * 100)}% |`),
  '', 'Expected and actual values, source texts, warnings, and metadata are in results.json.', '',
].join('\n'));
console.log(JSON.stringify(summary, null, 2));
console.log(`Full results: ${outputDirectory}`);
