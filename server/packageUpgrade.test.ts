import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import { checkUpgradeEligibility, createUpgradeOrderWithItem } from '../backend/db';

let directory: string;
let sqlite: InstanceType<typeof Database>;
let binding: any;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'xflex-upgrade-'));
  const filename = join(directory, 'fixture.sqlite');
  sqlite = new Database(filename);
  for (const file of ['004a_packages', '004c_orders', '004d_orderItems', '004e_packageSubscriptions', '013_upgrade_service', '046_add_terms_to_orders', '051_terms_acceptance_request_evidence']) {
    sqlite.exec(readFileSync(new URL(`../database/migrations/${file}.sql`, import.meta.url), 'utf8'));
  }
  sqlite.exec(`
    ALTER TABLE packages ADD COLUMN packageType TEXT NOT NULL DEFAULT 'standard';
    ALTER TABLE orders ADD COLUMN transactionPurpose TEXT;
    ALTER TABLE orderItems ADD COLUMN transactionPurpose TEXT;
    INSERT INTO packages (id,slug,nameEn,nameAr,upgradePrice) VALUES
      (1,'basic','Basic','Basic',0), (2,'comprehensive','Comprehensive','Comprehensive',30000),
      (3,'live-package','Live','Live',0);
    CREATE TRIGGER item_purpose BEFORE INSERT ON orderItems
    WHEN NOT EXISTS (SELECT 1 FROM orders WHERE id=NEW.orderId AND transactionPurpose=NEW.transactionPurpose)
    BEGIN SELECT RAISE(ABORT,'purpose mismatch'); END;
  `);
  binding = await createLocalD1Database(filename);
  db = drizzle(binding);
});

afterEach(() => {
  binding?.close();
  sqlite?.close();
  rmSync(directory, { recursive: true, force: true });
});

const own = (packageId: number, active = 1) => sqlite.prepare('INSERT INTO packageSubscriptions (userId,packageId,isActive,endDate) VALUES (42,?,?,?)').run(packageId, active, '2020-01-01');
const orderInput = () => ({
  userId: 42, status: 'pending', isUpgrade: true, upgradeFromPackageId: 1,
  transactionPurpose: 'upgrade', totalAmount: 30000, subtotal: 25862, vatAmount: 4138,
  currency: 'USD', paymentMethod: 'bank_transfer',
});

describe('package upgrade eligibility and persistence', () => {
  it('keeps Basic owners eligible after their monthly service dates expire', async () => {
    own(1);
    await expect(checkUpgradeEligibility(42, undefined, db)).resolves.toMatchObject({ eligible: true, currentPackageId: 1, targetPackageId: 2, upgradePrice: 30000 });
  });

  it('selects Basic even when another package was inserted first', async () => {
    own(3); own(1);
    await expect(checkUpgradeEligibility(42, 2, db)).resolves.toMatchObject({ currentPackageId: 1 });
  });

  it('rejects duplicate Comprehensive ownership regardless of subscription order', async () => {
    own(1); own(2);
    await expect(checkUpgradeEligibility(42, 2, db)).resolves.toBeNull();
  });

  it('rejects revoked Basic ownership and unsupported targets', async () => {
    own(1, 0);
    await expect(checkUpgradeEligibility(42, 2, db)).resolves.toBeNull();
    own(1);
    await expect(checkUpgradeEligibility(42, 3, db)).resolves.toBeNull();
  });

  it('persists a matching order and item in one batch and resumes that order', async () => {
    own(1);
    const order = await createUpgradeOrderWithItem(orderInput(), 2, db);
    expect(order).toMatchObject({ userId: 42, isUpgrade: true, status: 'pending', totalAmount: 30000 });
    expect(sqlite.prepare('SELECT orderId,packageId,transactionPurpose FROM orderItems').get()).toEqual({ orderId: order.id, packageId: 2, transactionPurpose: 'upgrade' });
    await expect(checkUpgradeEligibility(42, 2, db)).resolves.toMatchObject({ pendingOrderId: order.id });
  });

  it('rolls back the order if its package item cannot be persisted', async () => {
    sqlite.exec("CREATE TRIGGER reject_item BEFORE INSERT ON orderItems BEGIN SELECT RAISE(ABORT,'item unavailable'); END;");
    await expect(createUpgradeOrderWithItem(orderInput(), 2, db)).rejects.toThrow('item unavailable');
    expect(sqlite.prepare('SELECT count(*) AS count FROM orders').get()).toEqual({ count: 0 });
  });

  it('links the package to the order even when an acceptance trigger inserts another row', async () => {
    sqlite.exec(`
      CREATE TABLE acceptance_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER);
      INSERT INTO acceptance_evidence (id,order_id) VALUES (1000,0);
      CREATE TRIGGER record_acceptance AFTER INSERT ON orders
      BEGIN INSERT INTO acceptance_evidence (order_id) VALUES (NEW.id); END;
    `);
    const order = await createUpgradeOrderWithItem(orderInput(), 2, db);
    expect(sqlite.prepare('SELECT orderId FROM orderItems').get()).toEqual({ orderId: order.id });
    expect(sqlite.prepare('SELECT id FROM acceptance_evidence WHERE order_id=?').get(order.id)).toEqual({ id: 1001 });
  });

  it('allows a replacement after a failed order', async () => {
    own(1);
    const order = await createUpgradeOrderWithItem(orderInput(), 2, db);
    sqlite.prepare("UPDATE orders SET status='failed' WHERE id=?").run(order.id);
    await expect(checkUpgradeEligibility(42, 2, db)).resolves.toMatchObject({ pendingOrderId: null });
  });
});
