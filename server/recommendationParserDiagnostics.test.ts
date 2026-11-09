import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createLocalD1Database } from '../backend/_core/localD1';
vi.mock('../backend/db', () => ({ getDb: vi.fn() }));
import { getDb } from '../backend/db';
import { isParserCaptureActive, parseDraftWithDiagnostics, recordParserSubmission, listParserDiagnostics, cleanupParserDiagnostics } from '../backend/services/recommendation-parser-diagnostics.service';
let directory: string;
let sqlite: InstanceType<typeof Database>;
let client: Awaited<ReturnType<typeof createLocalD1Database>>;
const now = '2026-11-09T14:00:00.000Z';
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now)); vi.stubEnv('OPENAI_API_KEY','');
  directory=mkdtempSync(join(tmpdir(),'parser-diagnostics-'));
  const filename=join(directory,'fixture.sqlite');
  sqlite=new Database(filename);
  sqlite.exec('CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT)');
  sqlite.exec(readFileSync(new URL('../database/migrations/132_recommendation_parser_diagnostics.sql',import.meta.url),'utf8'));
  client=await createLocalD1Database(filename);
  vi.mocked(getDb).mockResolvedValue({$client:client} as any);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); (client as any)?.close(); sqlite?.close(); rmSync(directory,{recursive:true,force:true}); });
const enable = () => sqlite.prepare('INSERT INTO recommendation_parser_capture VALUES(1,?,?)').run(now,'2026-11-11T14:00:00.000Z');
describe('temporary parser diagnostics', () => {
  it('captures rules-only requests and associates corrections only with their author', async () => {
    enable();
    const parsed=await parseDraftWithDiagnostics('XAUUSD BUY 2400 SL 2390 TP1 2410',10);
    expect(parsed.diagnosticId).toBeTruthy();
    const fields={...parsed.fields,stopLoss:'2388'};
    await recordParserSubmission({diagnosticId:parsed.diagnosticId,actorUserId:11,messageId:90,content:'wrong author',fields});
    expect(sqlite.prepare('SELECT message_id FROM recommendation_parser_diagnostics').get()).toEqual({message_id:null});
    await recordParserSubmission({diagnosticId:parsed.diagnosticId,actorUserId:10,messageId:91,content:'XAUUSD BUY 2400',fields});
    const row=(await listParserDiagnostics())[0] as any;
    expect(row.message_id).toBe(91);
    expect(JSON.parse(row.submitted_fields_json).stopLoss).toBe('2388');
    expect(JSON.parse(row.final_fields_json).stopLoss).toBe('2390');
    await recordParserSubmission({diagnosticId:parsed.diagnosticId,actorUserId:10,messageId:92,content:'retry',fields});
    expect((await listParserDiagnostics())[0]).toMatchObject({message_id:91});
  });
  it('is off until enabled and stops exactly at the 48-hour deadline', async () => {
    expect((await parseDraftWithDiagnostics('XAUUSD BUY 2400',10)).diagnosticId).toBeUndefined();
    enable(); vi.setSystemTime(new Date('2026-11-11T14:00:00.000Z'));
    expect((await parseDraftWithDiagnostics('XAUUSD BUY 2400',10)).diagnosticId).toBeUndefined();
  });
  it('hides expired payloads, refuses edits, and deletes them during maintenance', async () => {
    enable();
    const parsed=await parseDraftWithDiagnostics('XAUUSD BUY 2400',10);
    vi.setSystemTime(new Date('2026-11-16T14:00:00.001Z'));
    expect(await listParserDiagnostics()).toHaveLength(0);
    await recordParserSubmission({diagnosticId:parsed.diagnosticId,actorUserId:10,messageId:91,content:'expired',fields:{}});
    expect(sqlite.prepare('SELECT message_id FROM recommendation_parser_diagnostics').get()).toEqual({message_id:null});
    await cleanupParserDiagnostics();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM recommendation_parser_diagnostics').get()).toEqual({n:0});
  });
  it('does not break extraction if diagnostic storage is unavailable', async () => {
    sqlite.exec('DROP TABLE recommendation_parser_capture');
    expect((await parseDraftWithDiagnostics('XAUUSD BUY 2400',10)).fields.entryPrice).toBe('2400');
  });
  it('rejects invalid or unbounded capture windows', () => {
    expect(isParserCaptureActive({starts_at:now,ends_at:'invalid'},Date.parse(now))).toBe(false);
    expect(isParserCaptureActive({starts_at:now,ends_at:'2027-11-09T14:00:00.000Z'},Date.parse(now))).toBe(false);
  });
});
