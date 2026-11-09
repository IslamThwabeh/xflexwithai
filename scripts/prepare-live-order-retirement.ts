import { readFileSync, writeFileSync } from 'node:fs';
import { buildLiveOrderRetirementStatements, type RetirementPlan } from '../backend/services/live-order-retirement.service';

// Prepare reviewable SQL from verified explicit terms. No authentication or
// production writes occur here. Wrangler executes the file transactionally.
const [planFile, outputFile] = process.argv.slice(2);
if (!planFile || !outputFile) throw new Error('Usage: prepare-live-order-retirement.ts <verified-plan.json> <output.sql>');
const plan = JSON.parse(readFileSync(planFile, 'utf8')) as RetirementPlan;
const statements = buildLiveOrderRetirementStatements(plan);
const literal = (value: string | number | null) => value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + value.replace(/'/g, "''") + "'";
writeFileSync(outputFile, statements.map(statement => {
  let position = 0;
  const sql = statement.sql.replace(/\?/g, () => literal(statement.params[position++]));
  if (position !== statement.params.length) throw new Error('Parameter count mismatch');
  return sql + ';';
}).join('\n') + '\n');
console.log('Prepared guarded retirement SQL: ' + outputFile);
