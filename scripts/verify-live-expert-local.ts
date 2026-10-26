/** Local-only browser fixture. Copies schema, never customer data. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

const root = resolve('tmp', `live-expert-qa-${Date.now()}`);
mkdirSync(root, { recursive: true });
const filename = resolve(root, 'qa.db');
const source = new Database(resolve('xflexwithai.dev.db'), { readonly: true });
const fixture = new Database(filename);
const schemas = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index','trigger') ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END").all() as { sql: string }[];
for (const row of schemas) fixture.exec(row.sql);
source.close();
if (!(fixture.prepare('PRAGMA table_info(live_package_sessions)').all() as { name: string }[]).some(column => column.name === 'session_type')) {
  fixture.exec(readFileSync(resolve('database/migrations/099_live_package_phase_2.sql'), 'utf8'));
}
fixture.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration_name TEXT UNIQUE NOT NULL, source TEXT NOT NULL, notes TEXT, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
fixture.exec(readFileSync(resolve('database/migrations/130_live_expert_messaging.sql'), 'utf8'));
if (!(fixture.prepare('PRAGMA table_info(staff_notifications)').all() as { name: string }[]).some(column => column.name === 'archivedAt')) {
  fixture.exec(readFileSync(resolve('database/migrations/115_staff_notification_archiving.sql'), 'utf8'));
}
if (!fixture.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'trade_copier_subscriptions'").get()) {
  fixture.exec(readFileSync(resolve('database/migrations/129_trade_copier_service.sql'), 'utf8'));
}
const now = new Date();
const endsAt = new Date(now.getTime() + 14 * 86400000).toISOString();
const startsAt = new Date(now.getTime() - 7 * 86400000).toISOString();
const fixtures = [[1,'Client A',0],[2,'Client B',0],[10,'live',1],[11,'Other expert',1],[12,'Support',1]] as const;
for (const [id,name,isStaff] of fixtures) fixture.prepare('INSERT INTO users (id,email,passwordHash,name,isStaff,emailVerified) VALUES (?,?,?,?,?,1)').run(id, `qa${id}@example.test`, 'local-fixture-no-password', name, isStaff);
fixture.exec("INSERT INTO admins (id,email,passwordHash,name) VALUES (1,'qa-admin@example.test','local-fixture-no-password','QA Admin')");
fixture.exec("INSERT INTO userRoles (userId,role) VALUES (10,'live_expert'),(11,'live_expert'),(12,'support')");
fixture.exec("INSERT INTO packages (id,slug,nameEn,nameAr,packageType,price,currency) VALUES (1,'live-package','Live Package','بكج لايف','live',200000,'ILS')");
const insertSetting = fixture.prepare('INSERT INTO admin_settings (settingKey,settingValue) VALUES (?,?)');
for (const [key,value] of Object.entries({ package_live_cohort_key: 'qa-cohort', package_live_cohort_status: 'in_progress', package_live_session_starts_at: startsAt, package_live_session_ends_at: endsAt, package_live_recording_policy: 'permanent' })) insertSetting.run(key,value);
for (const id of [1,2]) fixture.prepare("INSERT INTO live_package_entitlements (userId,packageId,cohortKey,sessionStartsAt,sessionEndsAt,recordingPolicy) VALUES (?,1,'qa-cohort',?,?,'permanent')").run(id, startsAt, endsAt);
fixture.exec('UPDATE live_expert_settings SET expert_user_id = 10 WHERE id = 1');
fixture.close();

process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = filename;
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.PORT = '3410';
process.env.VITE_API_URL = '';
process.env.PACKAGE_LIVE_DEPLOYMENT_ENABLED = 'true';
process.env.EMAIL_PROVIDER = 'disabled';
const { generateToken } = await import('../backend/_core/auth');
const db = await import('../backend/db');
await db.getDb();
for (const [id, name, isStaff] of [...fixtures, [-1, 'Admin', 1] as const]) {
  const sessionId = randomUUID();
  if (isStaff && id > 0) await db.startStaffSession({ staffUserId: id, sessionKey: sessionId });
  const token = await generateToken({ userId: Math.abs(id), email: id < 0 ? 'qa-admin@example.test' : `qa${id}@example.test`, type: id < 0 ? 'admin' : 'user', ...(isStaff && id > 0 ? { sessionId } : {}) });
  writeFileSync(resolve(root, `state-${id}.json`), JSON.stringify({ cookies: [{ name: 'app_session_id', value: token, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [{ origin: 'http://127.0.0.1:3410', localStorage: [{ name: 'language', value: 'en' }] }] }));
  console.log(`Local ${name} state: ${resolve(root, `state-${id}.json`)}`);
}
// Stand-in for private R2 for browser QA. Production uses its dedicated bucket.
const images = new Map<string, Uint8Array>();
(globalThis as any).ENV = { LIVE_EXPERT_ATTACHMENTS_BUCKET: {
  put: async (key: string, value: Uint8Array) => { images.set(key, new Uint8Array(value)); return {}; },
  get: async (key: string) => images.has(key) ? { arrayBuffer: async () => images.get(key)!.buffer } : null,
  delete: async (key: string) => { images.delete(key); },
} };
console.log(`Fixture database: ${filename}`);
await import('../backend/_core/index');
