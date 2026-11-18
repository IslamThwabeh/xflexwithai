import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Sqlite from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { createLocalD1Database } from '../backend/_core/localD1';
import { publishRecommendationManagement, executeRecommendationBatch } from '../backend/services/recommendation-integrity.service';
import { validateRecommendationLevels } from '../shared/recommendationIntegrity';

const ddl = `
CREATE TABLE recommendationMessages (id INTEGER PRIMARY KEY AUTOINCREMENT,userId INTEGER NOT NULL,type TEXT NOT NULL DEFAULT 'recommendation',content TEXT NOT NULL,symbol TEXT,side TEXT,entryPrice TEXT,stopLoss TEXT,takeProfit1 TEXT,takeProfit2 TEXT,takeProfit3 TEXT,riskPercent TEXT,resultOutcome TEXT,resultPips REAL,parentId INTEGER,threadStatus TEXT,closedAt TEXT,closedByUserId INTEGER,deliveryDiagnosticsJson TEXT,createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_recommendation_messages_parent_type_created_id ON recommendationMessages(parentId,type,createdAt,id);
CREATE TABLE users (id INTEGER PRIMARY KEY,email TEXT NOT NULL,isStaff INTEGER NOT NULL DEFAULT 0,login_blocked_at TEXT,notificationPrefs TEXT);
CREATE TABLE userRoles (id INTEGER PRIMARY KEY,userId INTEGER,role TEXT);
CREATE TABLE recommendation_deliveries (id INTEGER PRIMARY KEY,eventKey TEXT,eventKind TEXT,refId INTEGER,threadRootMessageId INTEGER,userId INTEGER,recipientEmail TEXT,language TEXT,status TEXT,skipReason TEXT,provider TEXT,providerRequestId TEXT,providerBatchKey TEXT,attemptedProviders TEXT,errorCategory TEXT,errorMessage TEXT,attempts INTEGER DEFAULT 0,subject TEXT,bodyText TEXT,bodyHtml TEXT,metadataJson TEXT,lastAttemptAt TEXT,createdAt TEXT,updatedAt TEXT,UNIQUE(eventKey,userId));
CREATE TABLE user_notifications (id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,title_en TEXT,title_ar TEXT,content_en TEXT,content_ar TEXT,action_url TEXT,batch_id TEXT,created_at TEXT);
CREATE INDEX idx_user_notifications_batch_user ON user_notifications(batch_id,user_id);
`;
let directory:string, raw:Sqlite.Database, local:any, orm:ReturnType<typeof drizzle>;
const request = () => ({rootId:1,requestId:crypto.randomUUID(),action:'cancel_pending' as const,reason:'Setup invalidated before entry',confirmUntriggered:true,actorUserId:9,isAdmin:false});
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),'xflex-integrity-'));
  const filename=join(directory,'test.db');raw=new Sqlite(filename);
  raw.exec(ddl);
  raw.exec(`INSERT INTO recommendationMessages (id,userId,content,symbol,side,entryPrice,stopLoss,takeProfit1) VALUES (1,9,'Synthetic pending entry','XAUUSD','BUY','100','90','110')`);
  raw.exec(readFileSync('database/migrations/136_recommendation_integrity.sql','utf8'));
  // Seed a future pending trade through INSERT, preserving the migrated legacy row.
  raw.exec(`INSERT INTO recommendationMessages (id,userId,content,symbol,side,entryPrice,stopLoss,takeProfit1,entryMode) VALUES (2,9,'Synthetic pending entry','XAUUSD','BUY','100','90','110','pending');
    INSERT INTO users (id,email) VALUES (101,'ar@example.com'),(102,'en@example.com'),(103,'other@example.com'),(104,'staff@example.com');
    INSERT INTO userRoles (userId,role) VALUES (104,'analyst');
    INSERT INTO recommendation_deliveries (eventKey,eventKind,refId,threadRootMessageId,userId,recipientEmail,language,status) VALUES
    ('rec_msg:2','recommendation',2,2,101,'ar@example.com','ar','sent'),('rec_msg:2','recommendation',2,2,102,'en@example.com','en','skipped'),('rec_msg:2','recommendation',2,2,104,'staff@example.com','en','sent');`);
  local=await createLocalD1Database(filename);orm=drizzle(local);
});
afterEach(()=>{local?.close();raw?.close();if(directory)rmSync(directory,{recursive:true,force:true});});
describe('published recommendation integrity',()=>{
  it('keeps legacy records and blocks deletion and rewriting even for old messages',()=>{
    expect(raw.prepare('SELECT entryMode FROM recommendationMessages WHERE id=1').get()).toEqual({entryMode:'legacy'});
    expect(()=>raw.exec('DELETE FROM recommendationMessages WHERE id=1')).toThrow(/cannot be deleted/);
    expect(()=>raw.exec("UPDATE recommendationMessages SET stopLoss='80' WHERE id=1")).toThrow(/immutable/);
    expect(()=>raw.exec("UPDATE recommendationMessages SET content='Changed' WHERE id=1")).toThrow(/immutable/);
    expect(()=>raw.exec("UPDATE recommendationMessages SET entryMode='pending' WHERE id=1")).toThrow(/immutable/);
  });
  it('commits cancellation and original-audience bilingual notices atomically and makes retries idempotent',async()=>{
    const input={...request(),rootId:2};
    const first=await publishRecommendationManagement(orm,input);
    expect(await publishRecommendationManagement(orm,input)).toEqual(first);
    expect(raw.prepare('SELECT cancelledAt,threadStatus FROM recommendationMessages WHERE id=2').get()).toMatchObject({cancelledAt:expect.any(String),threadStatus:'closed'});
    const mail=raw.prepare("SELECT userId,eventKind,bodyText,bodyHtml FROM recommendation_deliveries WHERE eventKind='management' ORDER BY userId").all() as any[];
    expect(mail.map(r=>r.userId)).toEqual([101,102]); // online/original audience included; staff and unrelated client excluded
    expect(mail[0].bodyText).toContain('ألغِ أمر الدخول');expect(mail[1].bodyText).toContain('does not execute any broker action');
    expect(mail.every(r=>!r.bodyText.includes('staff@example.com'))).toBe(true);
    expect(raw.prepare('SELECT COUNT(*) n FROM user_notifications').get()).toEqual({n:2});
    expect(()=>raw.exec("INSERT INTO recommendationMessages(userId,type,content,parentId) VALUES(9,'result','-50 pips',2)")).toThrow(/cancelled/);
  });
  it('rolls back the notice and cancellation if outbox insertion fails',async()=>{
    raw.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON recommendation_deliveries WHEN NEW.eventKind='management' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
    await expect(publishRecommendationManagement(orm,{...request(),rootId:2})).rejects.toThrow();
    expect(raw.prepare('SELECT cancelledAt FROM recommendationMessages WHERE id=2').get()).toEqual({cancelledAt:null});
    expect(raw.prepare('SELECT COUNT(*) n FROM recommendationMessages WHERE parentId=2').get()).toEqual({n:0});
    expect(raw.prepare('SELECT COUNT(*) n FROM user_notifications').get()).toEqual({n:0});
  });
  it('rejects cross-manager actions and immediate-entry cancellations',async()=>{
    await expect(publishRecommendationManagement(orm,{...request(),rootId:2,actorUserId:126})).rejects.toThrow(/unavailable/);
    await expect(publishRecommendationManagement(orm,request())).rejects.toThrow(/untriggered/);
    await expect(publishRecommendationManagement(orm,{...request(),rootId:2,confirmUntriggered:false})).rejects.toThrow(/untriggered/);
  });
  it('will not cancel after any result or update and retains losses',async()=>{
    raw.exec("INSERT INTO recommendationMessages(userId,type,content,parentId) VALUES(9,'result','Stopped -50 pips',2)");
    await expect(publishRecommendationManagement(orm,{...request(),rootId:2})).rejects.toThrow(/follow-ups/);
    expect(()=>raw.exec('DELETE FROM recommendationMessages WHERE parentId=2')).toThrow();
    expect(()=>raw.exec("UPDATE recommendationMessages SET resultOutcome='win',resultPips=50 WHERE parentId=2")).toThrow(/audited/);
  });
  it('preserves early-close instructions and escapes untrusted email content',async()=>{
    await publishRecommendationManagement(orm,{...request(),rootId:2,action:'early_close',reason:'Close at market <script>unsafe</script>'});
    expect(raw.prepare('SELECT cancelledAt FROM recommendationMessages WHERE id=2').get()).toEqual({cancelledAt:null});
    const mail=raw.prepare("SELECT bodyText,bodyHtml FROM recommendation_deliveries WHERE eventKind='management' AND language='en'").get() as any;
    expect(mail.bodyText).toContain('result remains part of performance');
    expect(mail.bodyHtml).not.toContain('<script>unsafe');expect(mail.bodyHtml).toContain('&lt;script&gt;');
  });
  it('allows only append-only, atomic corrections of recorded outcomes',async()=>{
    raw.exec("INSERT INTO recommendationMessages(id,userId,type,content,parentId) VALUES(3,9,'result','Stopped -50 pips',2)");
    await executeRecommendationBatch(orm,[
      sql`INSERT INTO recommendation_result_corrections(messageId,actorUserId,reason,previousOutcome,previousPips,outcome,pips,createdAt) VALUES(3,-1,'Verified correction',NULL,NULL,'loss',-50,'2026-11-18')`,
      sql`UPDATE recommendationMessages SET resultOutcome='loss',resultPips=-50 WHERE id=3`,
    ]);
    expect(()=>raw.exec('DELETE FROM recommendation_result_corrections')).toThrow(/append only/);
    expect(()=>raw.exec("UPDATE recommendation_result_corrections SET pips=50")).toThrow(/append only/);
    expect(()=>raw.exec("UPDATE recommendationMessages SET resultPips=50 WHERE id=3")).toThrow(/audited/);
  });
  it('does not score management prose and supports audited breakeven corrections',async()=>{
    await publishRecommendationManagement(orm,{...request(),rootId:2,action:'correction',reason:'Clarification: +300 pips is only quoted context, not a result'});
    raw.exec("INSERT INTO recommendationMessages(id,userId,type,content,parentId) VALUES(20,9,'result','Stopped -50 pips',1)");
    const database=await import('../backend/db');
    await database.getDb({DB:local});
    const month=new Date().toISOString().slice(0,7);
    let report=await database.getRecommendationMonthlyTradeReport(month,9);
    expect(report.summary).toMatchObject({totalTrades:1,losingTrades:1,totalPipsLost:-50});
    await expect(database.saveRecommendationTradeResultOverride({messageId:20,outcome:'win',pips:50,analystUserId:9,isAdmin:false,reason:'Not allowed'})).rejects.toThrow(/full admins/);
    await database.saveRecommendationTradeResultOverride({messageId:20,outcome:'breakeven',pips:0,analystUserId:-1,isAdmin:true,reason:'BO verified zero outcome'});
    report=await database.getRecommendationMonthlyTradeReport(month,9);
    expect(report.summary).toMatchObject({totalTrades:1,winningTrades:0,losingTrades:0,breakevenTrades:1,winRate:0});
    expect(raw.prepare('SELECT content FROM recommendationMessages WHERE id=20').get()).toEqual({content:'Stopped -50 pips'});
    expect(raw.prepare('SELECT previousOutcome,previousPips,outcome,pips FROM recommendation_result_corrections').get()).toMatchObject({outcome:'breakeven',pips:0});
  },20000);
});
describe('recommendation levels',()=>{
  it.each([
    [{side:'BUY',entryPrice:'100',stopLoss:'90',takeProfit1:'110'},null],
    [{side:'SELL',entryPrice:'100',stopLoss:'110',takeProfit1:'90',takeProfit2:'80'},null],
    [{side:'BUY',entryPrice:'100',stopLoss:'101',takeProfit1:'110'},'Stop loss'],
    [{side:'BUY',entryPrice:'100',stopLoss:'90',takeProfit1:'110',takeProfit2:'105'},'Targets'],
    [{side:'BUY',entryPrice:'100',stopLoss:'90'},'Enter valid'],
    [{side:'BUY',entryPrice:'Infinity',stopLoss:'90',takeProfit1:'110'},'Enter valid'],
  ])('checks required levels and direction', (input,error)=>{
    const actual=validateRecommendationLevels(input);if(error===null)expect(actual).toBeNull();else expect(actual).toContain(error);
  });
});
