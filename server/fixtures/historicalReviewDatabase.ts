import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/d1";
import { createLocalD1Database } from "../../backend/_core/localD1";

export async function historicalReviewDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "xflex-historical-review-")),
    filename = join(directory, "review.sqlite"),
    seed = new Database(filename);
  seed.exec(`
    CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT,applied_at TEXT);
    CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,totalAmount INTEGER,currency TEXT,paymentReference TEXT,paymentProofUrl TEXT,createdAt TEXT);
    CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,orderId INTEGER,packageId INTEGER,price INTEGER,currency TEXT,
      activatedAt TEXT,isActive INTEGER,isRenewal INTEGER DEFAULT 0,isUpgrade INTEGER DEFAULT 0,createdAt TEXT,email TEXT,keyCode TEXT);
  `);
  for (const name of [
    "106_financial_management_foundation.sql",
    "108_financial_ledger_source_idempotency.sql",
    "110_financial_expense_workflow.sql",
    "111_financial_reporting_indexes.sql",
    "112_financial_controls.sql",
    "113_historical_financial_reconciliation.sql",
  ])
    seed.exec(
      readFileSync(
        new URL("../../database/migrations/" + name, import.meta.url),
        "utf8"
      )
    );
  seed.exec(`
    ALTER TABLE financial_ledger_entries ADD COLUMN transaction_purpose TEXT;
    INSERT INTO orders VALUES(1,'completed',10000,'ILS',NULL,'https://private.invalid/receipt','2026-10-01 10:00:00'),
      (2,'completed',20000,'ILS',NULL,NULL,'2026-10-01T10:00:00Z');
    INSERT INTO order_payment_confirmations(order_id,paid_at,rationale,confirmed_by_type,source_type)
      VALUES(2,'2026-10-02T00:00:00Z','Verified synthetic receipt','admin','order_payment_new_sale');
    INSERT INTO registrationKeys(id,orderId,packageId,price,currency,isActive,isRenewal,createdAt,email,keyCode) VALUES
      (10,NULL,2,500,'USD',1,0,'2026-10-01 10:00:00','private@example.invalid','XFLEX-PRIVATE-KEY'),
      (11,NULL,NULL,100,'USD',1,1,'CURRENT_TIMESTAMP','private@example.invalid','XFLEX-OTHER-PRIVATE-KEY');
    INSERT INTO financial_reconciliation_items(id,source_type,source_reference,issue_type,confidence_level,
      proposed_treatment,proposed_amount_ils_minor,notes,created_at,updated_at) VALUES
      (1,'order','1','completed_order_without_cash_confirmation','medium','historical_payment_known_date',10000,'Verified synthetic evidence','2026-10-01T00:00:00Z','2026-10-01T10:00:00Z'),
      (2,'order','2','completed_order_without_cash_confirmation','low','historical_payment_known_date',20000,NULL,'2026-10-01T00:00:00Z','2026-10-01T10:00:00Z'),
      (3,'registration_key','10','priced_key_without_order','low','historical_payment_known_date',NULL,NULL,'2026-10-01T00:00:00Z','2026-10-01T10:00:00Z'),
      (4,'renewal_key','11','renewal_key_without_order_payment','low','requires_owner_review',NULL,NULL,'2026-10-01T00:00:00Z','2026-10-01T10:00:00Z');
  `);
  const insert = seed.prepare(
    "INSERT INTO financial_reconciliation_items(id,source_type,source_reference,issue_type,confidence_level,proposed_treatment,notes,created_at,updated_at) VALUES(?,'order',?,'completed_order_without_cash_confirmation','low','requires_owner_review',NULL,'2026-11-20T00:00:00Z','2026-11-20T10:00:00Z')"
  );
  seed.transaction(() => {
    for (let index = 100; index < 250; index++)
      insert.run(index, String(index + 1000));
  })();
  const audit = seed.prepare(
    "INSERT INTO financial_reconciliation_events(reconciliation_item_id,action,actor_type,actor_id,reason,metadata,created_at) VALUES(1,'draft_updated','admin',1,'Synthetic prior evidence review',?,'2026-10-01T10:00:00Z')"
  );
  for (let index = 0; index < 30; index++)
    audit.run(
      JSON.stringify({
        privateEmail: "private@example.invalid",
        privateKey: "XFLEX-PRIVATE-KEY",
        index,
      })
    );
  seed.close();
  const client = await createLocalD1Database(filename);
  return {
    client,
    orm: drizzle(client),
    filename,
    close() {
      (client as any).close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
