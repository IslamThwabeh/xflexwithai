import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const BASIC_PRICE = 100_000;
const COMPREHENSIVE_PRICE = 35_000;
const NEW_PRICE = 200_000;

function createPricingDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE packages (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      userId INTEGER NOT NULL,
      status TEXT NOT NULL,
      isGift INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      completedAt TEXT
    );
    CREATE TABLE orderItems (
      id INTEGER PRIMARY KEY,
      orderId INTEGER NOT NULL,
      itemType TEXT NOT NULL,
      itemId INTEGER NOT NULL,
      priceAtPurchase INTEGER NOT NULL
    );
    INSERT INTO packages (id, slug) VALUES (1, 'basic'), (2, 'comprehensive'), (3, 'live-package');
  `);
  return db;
}

function addOrder(db: Database.Database, input: {
  id: number;
  userId: number;
  status: string;
  slug: "basic" | "comprehensive" | "live-package";
  at: string;
}) {
  const packageId = input.slug === "basic" ? 1 : input.slug === "comprehensive" ? 2 : 3;
  db.prepare("INSERT INTO orders (id, userId, status, createdAt, updatedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.id, input.userId, input.status, input.at, input.at, input.at);
  db.prepare("INSERT INTO orderItems (id, orderId, itemType, itemId, priceAtPurchase) VALUES (?, ?, 'package', ?, ?)")
    .run(input.id * 10, input.id, packageId, 1);
}

function quote(db: Database.Database, userId: number, asOfIso = "2026-09-04T12:00:00.000Z") {
  const row = db.prepare(`
    SELECT p.slug
    FROM orderItems oi
    INNER JOIN orders o ON oi.orderId = o.id
    INNER JOIN packages p ON oi.itemId = p.id
    WHERE o.userId = ?
      AND o.isGift = 0
      AND oi.itemType = 'package'
      AND p.slug IN ('basic', 'comprehensive')
      AND o.status IN ('paid', 'completed')
      AND COALESCE(o.completedAt, o.updatedAt, o.createdAt) <= ?
    ORDER BY COALESCE(o.completedAt, o.updatedAt, o.createdAt) DESC, o.id DESC, oi.id DESC
    LIMIT 1
  `).get(userId, asOfIso) as { slug: string } | undefined;
  if (row?.slug === "comprehensive") return { price: COMPREHENSIVE_PRICE, reason: "previous Comprehensive customer" };
  if (row?.slug === "basic") return { price: BASIC_PRICE, reason: "previous Basic customer" };
  return { price: NEW_PRICE, reason: "new Live Package customer" };
}

describe("Live Package historical-customer pricing query", () => {
  it("prices new, active, expired, and mixed historical package customers from paid history", () => {
    const db = createPricingDb();
    addOrder(db, { id: 1, userId: 2, status: "completed", slug: "basic", at: "2026-01-01T00:00:00.000Z" });
    addOrder(db, { id: 2, userId: 3, status: "completed", slug: "comprehensive", at: "2026-01-01T00:00:00.000Z" });
    addOrder(db, { id: 3, userId: 4, status: "completed", slug: "basic", at: "2026-01-01T00:00:00.000Z" });
    addOrder(db, { id: 4, userId: 4, status: "completed", slug: "comprehensive", at: "2026-02-01T00:00:00.000Z" });
    addOrder(db, { id: 5, userId: 5, status: "completed", slug: "comprehensive", at: "2026-01-01T00:00:00.000Z" });
    addOrder(db, { id: 6, userId: 5, status: "completed", slug: "basic", at: "2026-02-01T00:00:00.000Z" });

    expect(quote(db, 1).price).toBe(NEW_PRICE);
    expect(quote(db, 2)).toEqual({ price: BASIC_PRICE, reason: "previous Basic customer" });
    expect(quote(db, 3)).toEqual({ price: COMPREHENSIVE_PRICE, reason: "previous Comprehensive customer" });
    expect(quote(db, 4).price).toBe(COMPREHENSIVE_PRICE);
    expect(quote(db, 5).price).toBe(BASIC_PRICE);
    db.close();
  });

  it("ignores invalid newer purchases, Live purchases, and frontend-supplied prices", () => {
    const db = createPricingDb();
    addOrder(db, { id: 1, userId: 7, status: "completed", slug: "basic", at: "2026-01-01T00:00:00.000Z" });
    addOrder(db, { id: 2, userId: 7, status: "refunded", slug: "comprehensive", at: "2026-03-01T00:00:00.000Z" });
    addOrder(db, { id: 3, userId: 7, status: "completed", slug: "live-package", at: "2026-04-01T00:00:00.000Z" });

    expect(quote(db, 7).price).toBe(BASIC_PRICE);
    expect(quote(db, 7, "2025-12-31T23:59:59.000Z").price).toBe(NEW_PRICE);
    db.close();
  });
});
