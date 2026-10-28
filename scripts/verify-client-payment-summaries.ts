/** Read-only candidate verification. No application mutations or deployments. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { buildClientPaymentSummaries, CLIENT_PAYMENT_SOURCE_SQL, CLIENT_PAYMENT_SOURCE_LIMIT, type ClientPaymentSources } from '../backend/services/client-payment-summary.service';

const wranglerIndex = process.argv.indexOf('--wrangler');
const wrangler = wranglerIndex >= 0 ? process.argv[wranglerIndex + 1] : null;
if (!process.argv.includes('--production-read-only') || !wrangler) {
  throw new Error('Use --production-read-only --wrangler <absolute Wrangler JS entry>. Returns aggregate verification only.');
}
const columns: Record<keyof ClientPaymentSources, string[]> = {
  orders: ['id', 'userId', 'status', 'transactionPurpose', 'isGift'],
  ledger: ['id', 'entryType', 'status', 'amountMinor', 'orderId', 'refundId', 'keyId', 'sourceType', 'sourceReference', 'reversalOfEntryId'],
  confirmations: ['id', 'orderId'], keys: ['id', 'email', 'packageId', 'orderId', 'price', 'activatedAt', 'isActive', 'issuancePurpose', 'legacyMigrationId'],
  refunds: ['id', 'userId', 'orderId'], reconciliations: ['id', 'sourceType', 'sourceReference', 'status', 'proposedTreatment'],
};
function query(sql: string) {
  if (!/^\s*(SELECT|EXPLAIN QUERY PLAN SELECT)\b/.test(sql) || /;\s*\S/.test(sql)) throw new Error('One read-only statement required');
  const raw = execFileSync(process.execPath, [wrangler!, 'd1', 'execute', 'xflexwithai-db', '--remote', '--config',
    'wrangler-worker.toml', '--env', 'production', '--command', sql, '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const result = JSON.parse(raw.slice(raw.indexOf('[')))[0];
  if (!result.success || result.meta?.rows_written !== 0 || result.meta?.changed_db !== false) throw new Error('Read-only verification failed');
  return result;
}
const jsonRows = (sql: string, names: string[]) => `(SELECT json_group_array(json_object(${names.map(name => `'${name}',${name}`).join(',')})) FROM (${sql}))`;
const parts = Object.entries(CLIENT_PAYMENT_SOURCE_SQL).map(([name, sql]) => `${jsonRows(sql.replace('?', String(CLIENT_PAYMENT_SOURCE_LIMIT + 1)), columns[name as keyof ClientPaymentSources])} AS ${name}`);
parts.push(`${jsonRows('SELECT id,email FROM users WHERE isStaff=0 ORDER BY id LIMIT 5001', ['id', 'email'])} AS clients`);
// This independent attribution uses SQL joins/grouping, not the candidate's
// JS maps. Complex corrections require their own bridge before certification.
parts.push(`${jsonRows(`SELECT COALESCE(r.user_id,o.userId) AS userId,
  SUM(CASE WHEN l.entry_type='payment' THEN l.base_amount_ils_minor ELSE 0 END) AS receiptsMinor,
  -SUM(CASE WHEN l.entry_type='refund' THEN l.base_amount_ils_minor ELSE 0 END) AS refundsMinor,
  group_concat(l.id) AS entryIds FROM financial_ledger_entries l
  LEFT JOIN orders o ON o.id=l.order_id LEFT JOIN account_refunds r ON r.id=l.refund_id
  WHERE l.status='approved' AND l.entry_type IN ('payment','refund')
  GROUP BY COALESCE(r.user_id,o.userId)`, ['userId', 'receiptsMinor', 'refundsMinor', 'entryIds'])} AS independent`);
const snapshot = query(`SELECT ${parts.join(',')}`);
const rawSources = snapshot.results[0];
const sources = Object.fromEntries(Object.keys(columns).map(name => [name, JSON.parse(rawSources[name])])) as ClientPaymentSources;
const clients = JSON.parse(rawSources.clients) as Array<{ id: number; email: string }>;
if (clients.length > 5000 || Object.values(sources).some(rows => rows.length > CLIENT_PAYMENT_SOURCE_LIMIT)) throw new Error('Source ceiling exceeded');
if (sources.ledger.some(row => ['adjustment', 'reversal'].includes(row.entryType))) throw new Error('Complex corrections present: certify their explicit bridge before release');
const generatedAt = new Date().toISOString();
const started = performance.now();
const candidate = buildClientPaymentSummaries(clients, sources, generatedAt);
const calculationMs = performance.now() - started;
const independent = new Map<number, { receiptsMinor: number; refundsMinor: number; entryIds: string }>(
  JSON.parse(rawSources.independent).map((row: any) => [row.userId, row]));
let differences = 0;
let profileDifferences = 0;
const coverage: Record<string, number> = {};
let receiptsMinor = 0; let refundsMinor = 0;
for (const client of clients) {
  const summary = candidate.summaries.get(client.id)!;
  const expected = independent.get(client.id);
  const ids = (candidate.attributedEntryIds.get(client.id) ?? []).sort((a, b) => a - b).join(',');
  const expectedIds = (expected?.entryIds?.split(',').map(Number) ?? []).sort((a, b) => a - b).join(',');
  if (summary.receiptsMinor !== (expected?.receiptsMinor ?? 0) || summary.refundsMinor !== (expected?.refundsMinor ?? 0) || ids !== expectedIds) differences++;
  if (JSON.stringify(summary) !== JSON.stringify(buildClientPaymentSummaries([client], sources, generatedAt).summaries.get(client.id))) profileDifferences++;
  coverage[summary.coverage] = (coverage[summary.coverage] ?? 0) + 1;
  receiptsMinor += summary.receiptsMinor ?? 0; refundsMinor += summary.refundsMinor ?? 0;
}
const queryPlans: Record<string, unknown> = {};
const sourceReadCosts: Record<string, { rowsRead: number; sqlMs: number }> = {};
let planReads = 0;
for (const [name, sql] of Object.entries(CLIENT_PAYMENT_SOURCE_SQL)) {
  const result = query(`EXPLAIN QUERY PLAN ${sql.replace('?', String(CLIENT_PAYMENT_SOURCE_LIMIT + 1))}`);
  queryPlans[name] = result.results; planReads += result.meta.rows_read;
  const measured = query(sql.replace('?', String(CLIENT_PAYMENT_SOURCE_LIMIT + 1)));
  sourceReadCosts[name] = { rowsRead: measured.meta.rows_read, sqlMs: measured.meta.duration };
}
const report = {
  generatedAt, sourceCounts: Object.fromEntries(Object.entries(sources).map(([name, rows]) => [name, rows.length])),
  clients: clients.length, coverage, receiptsMinor, refundsMinor, netPaidMinor: receiptsMinor - refundsMinor,
  perClientAmountOrSourceDifferences: differences, listProfileDifferences: profileDifferences,
  unattributedMinor: candidate.unattributedMinor, excludedAdjustmentMinor: candidate.excludedAdjustmentMinor,
  candidateCalculationMs: calculationMs, snapshotRowsRead: snapshot.meta.rows_read,
  snapshotSqlMs: snapshot.meta.duration, queryPlanRowsRead: planReads, rowsWritten: 0,
  requestSourceRowsRead: Object.values(sourceReadCosts).reduce((sum, cost) => sum + cost.rowsRead, 0),
  sourceReadCosts, queryPlans,
};
writeFileSync('tmp/client-payment-candidate-production-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (differences || profileDifferences) process.exitCode = 1;
