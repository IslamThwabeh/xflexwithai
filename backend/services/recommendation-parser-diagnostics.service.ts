import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../db';
import { logger } from '../_core/logger';
import {
  parseRecommendationDraft, RECOMMENDATION_FIELD_NAMES, RECOMMENDATION_PARSER_VERSION,
  type RecommendationParsedFields, type RecommendationParseTrace,
} from './recommendation-parser.service';

const RETENTION_MS = 7 * 86_400_000;
async function client() {
  const connection = await getDb();
  return (connection as { $client?: D1Database } | null)?.$client;
}

export function isParserCaptureActive(window: { starts_at: string; ends_at: string } | null | undefined, now: number) {
  if (!window) return false;
  const start = Date.parse(window.starts_at);
  const end = Date.parse(window.ends_at);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 2 * 86_400_000 && start <= now && now < end;
}

export async function parseDraftWithDiagnostics(rawText: string, actorUserId: number) {
  const started = Date.now();
  let trace: RecommendationParseTrace | undefined;
  const result = await parseRecommendationDraft(rawText, value => { trace = value; });
  let diagnosticId: string | undefined;
  try {
    const database = await client();
    if (database && trace) {
      const window = await database.prepare('SELECT starts_at, ends_at FROM recommendation_parser_capture WHERE id = 1').first<{ starts_at: string; ends_at: string }>();
      if (isParserCaptureActive(window, started) && isParserCaptureActive(window, Date.now())) {
        const id = crypto.randomUUID();
        await database.prepare('INSERT INTO recommendation_parser_diagnostics (id, actor_user_id, parser_version, draft, rule_fields_json, ai_fields_json, final_fields_json, parser_json, ai_outcome, duration_ms, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, actorUserId, RECOMMENDATION_PARSER_VERSION, rawText.trim().slice(0, 4000),
            JSON.stringify(trace.ruleFields), trace.aiFields ? JSON.stringify(trace.aiFields) : null,
            JSON.stringify(result.fields), JSON.stringify(result.parser), trace.aiOutcome,
            Date.now() - started, new Date(started).toISOString(), new Date(started + RETENTION_MS).toISOString()).run();
        diagnosticId = id;
      }
    }
  } catch {
    // Never block auto-fill or write draft content to broad logs.
    logger.warn('[PARSER_DIAGNOSTICS] Capture unavailable');
  }
  return { ...result, diagnosticId };
}

export async function recordParserSubmission(input: {
  diagnosticId?: string; actorUserId: number; messageId: number; content: string;
  fields: Partial<Record<keyof RecommendationParsedFields, string>>;
}) {
  if (!input.diagnosticId) return;
  try {
    const database = await client();
    if (!database) return;
    const fields = Object.fromEntries(RECOMMENDATION_FIELD_NAMES.map(field => [field, input.fields[field] ?? null]));
    await database.prepare('UPDATE recommendation_parser_diagnostics SET submitted_fields_json = ?, submitted_content = ?, message_id = ? WHERE id = ? AND actor_user_id = ? AND message_id IS NULL AND expires_at > ?')
      .bind(JSON.stringify(fields), input.content.slice(0, 4000), input.messageId, input.diagnosticId, input.actorUserId, new Date().toISOString()).run();
  } catch {
    logger.warn('[PARSER_DIAGNOSTICS] Submission capture unavailable');
  }
}

export async function listParserDiagnostics(limit = 100) {
  const database = await client();
  if (!database) return [];
  return (await database.prepare('SELECT * FROM recommendation_parser_diagnostics WHERE expires_at > ? ORDER BY created_at DESC LIMIT ?')
    .bind(new Date().toISOString(), Math.max(1, Math.min(100, limit))).all()).results;
}

export async function cleanupParserDiagnostics() {
  const database = await client();
  if (!database) return;
  await database.prepare('DELETE FROM recommendation_parser_diagnostics WHERE id IN (SELECT id FROM recommendation_parser_diagnostics WHERE expires_at <= ? LIMIT 500)')
    .bind(new Date().toISOString()).run();
}
