import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { readStudentDirectory } from "../backend/services/student-directory.service";
import { studentDirectoryExportTable } from "../shared/studentDirectoryExport";
import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { readCustomerReport } from "../backend/services/customer-report.service";
import {
  CUSTOMER_COUNTRY_CODES,
  customerCountryCode,
  customerCountryDisplay,
  isValidCustomerCity,
} from "../shared/customerLocation";
import {
  customerReportDate,
  customerServiceState,
  type CustomerReportRow,
} from "../shared/customerReport";
import {
  buildCustomerReportCsv,
  buildCustomerReportPrint,
  customerCsvCell,
  customerExportTable,
} from "../shared/customerReportExport";

let sqlite: Database.Database;
const statements: string[] = [];
const scope = {
  viewerId: 1,
  accessVersion: "payments",
  canViewClientPayments: true,
  paymentsEnabled: true,
};
const filter = {
  search: "",
  country: "",
  sort: "registered" as const,
  direction: "desc" as const,
  page: 1,
  pageSize: 20 as const,
  includePayments: false,
};
let client: D1Database;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-27T12:00:00Z"));
  statements.length = 0;
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT);
    CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,phone TEXT,city TEXT,country TEXT,createdAt TEXT,isStaff INTEGER,passwordHash TEXT,login_blocked_at TEXT,login_block_reason TEXT,login_blocked_by INTEGER,lastSignedIn TEXT,emailVerified INTEGER,brokerOnboardingComplete INTEGER);
    CREATE TABLE enrollments(id INTEGER PRIMARY KEY,userId INTEGER,courseId INTEGER,isAdminSkipped INTEGER,progressPercentage INTEGER);
    CREATE INDEX idx_enrollments_user_course ON enrollments(userId,courseId);
    CREATE TABLE packages(id INTEGER PRIMARY KEY,nameEn TEXT,nameAr TEXT);
    CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,email TEXT,packageId INTEGER,orderId INTEGER,price INTEGER,activatedAt TEXT,isActive INTEGER,isRenewal INTEGER,issuancePurpose TEXT,legacyMigrationId INTEGER,keyCode TEXT);
    CREATE TABLE packageSubscriptions(id INTEGER PRIMARY KEY,userId INTEGER,packageId INTEGER,isActive INTEGER,startDate TEXT,endDate TEXT);
    CREATE TABLE lexaiSubscriptions(id INTEGER PRIMARY KEY,userId INTEGER,isActive INTEGER,isPaused INTEGER,pausedRemainingDays INTEGER,isPendingActivation INTEGER,startDate TEXT,endDate TEXT);
    CREATE TABLE recommendationSubscriptions(id INTEGER PRIMARY KEY,userId INTEGER,isActive INTEGER,isPaused INTEGER,pausedRemainingDays INTEGER,isPendingActivation INTEGER,startDate TEXT,endDate TEXT);
    CREATE INDEX idx_recommendationSubscriptions_userId ON recommendationSubscriptions(userId);
    CREATE TABLE trade_copier_subscriptions(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT,starts_at TEXT,ends_at TEXT,trading_account_ref TEXT);
    CREATE INDEX idx_trade_copier_subscriptions_user_status ON trade_copier_subscriptions(user_id,status,id);
    CREATE TABLE orders(id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,transactionPurpose TEXT,isGift INTEGER);
    CREATE TABLE account_refunds(id INTEGER PRIMARY KEY,user_id INTEGER,order_id INTEGER);
    CREATE TABLE order_payment_confirmations(id INTEGER PRIMARY KEY,order_id INTEGER);
    CREATE TABLE financial_reconciliation_items(id INTEGER PRIMARY KEY,source_type TEXT,source_reference TEXT,status TEXT,proposed_treatment TEXT);
    CREATE TABLE financial_ledger_entries(id INTEGER PRIMARY KEY,entry_type TEXT,status TEXT,base_amount_ils_minor INTEGER,order_id INTEGER,refund_id INTEGER,registration_key_id INTEGER,source_type TEXT,source_reference TEXT,reversal_of_entry_id INTEGER);
  `);
  const migration = readFileSync(
    new URL(
      "../database/migrations/142_customer_report_pages.sql",
      import.meta.url
    ),
    "utf8"
  );
  sqlite.exec(migration);
  sqlite.exec(migration);
  const insert = sqlite.prepare(
    "INSERT INTO users(id,name,email,phone,city,country,createdAt,isStaff,passwordHash) VALUES(?,?,?,?,?,?,?,?,?)"
  );
  for (let id = 1; id <= 65; id++)
    insert.run(
      id,
      `Customer ${id}`,
      `customer${id}@example.invalid`,
      "+9700599000000",
      id === 1 ? "Nablus" : "City",
      id % 2 ? "Palestine" : "PS",
      "2026-10-01 10:00:00",
      0,
      "PRIVATE_HASH"
    );
  insert.run(
    100,
    "Staff",
    "staff@example.invalid",
    "",
    "",
    "JO",
    "2026-11-01",
    1,
    "PRIVATE_HASH"
  );
  sqlite.exec(`INSERT INTO packages VALUES(2,'Comprehensive','الشاملة');
    INSERT INTO registrationKeys VALUES(1,' CUSTOMER1@EXAMPLE.INVALID ',2,NULL,999,'2026-11-01',1,1,'commercial',NULL,'PRIVATE_KEY'),(2,'customer1@example.invalid',2,NULL,999,NULL,1,0,'commercial',NULL,'PRIVATE_KEY2');
    INSERT INTO packageSubscriptions VALUES(1,1,2,1,'2026-01-01',NULL),(2,2,2,1,'2026-01-01','2026-02-01');
    INSERT INTO lexaiSubscriptions VALUES(1,1,1,0,NULL,1,'2026-11-01','2026-11-02');
    INSERT INTO recommendationSubscriptions VALUES(1,1,1,1,14,0,'2026-01-01','2026-02-01');
    INSERT INTO trade_copier_subscriptions VALUES(1,1,'active','2026-11-01','2027-11-01','PRIVATE_TRADING_REF');
    INSERT INTO orders VALUES(10,1,'completed','new_sale',0),(20,2,'completed','renewal',0);
    INSERT INTO order_payment_confirmations VALUES(1,10),(2,20);
    INSERT INTO financial_ledger_entries VALUES(1,'payment','approved',10000,10,NULL,NULL,'order_payment_new_sale','order:10',NULL),
      (2,'payment','approved',20000,20,NULL,NULL,'order_payment_renewal','order:20',NULL),
      (3,'reversal','approved',-10000,10,NULL,NULL,'financial_reversal','ledger:1:reversal',1),
      (4,'adjustment','approved',9000,10,NULL,NULL,'financial_replacement','ledger:1:replacement',NULL);
  `);
  const prepare = (sql: string, values: unknown[] = []): any => ({
    sql,
    values,
    bind: (...next: unknown[]) => prepare(sql, next),
    all: async () => {
      statements.push(sql);
      const statement = sqlite.prepare(sql);
      if (!statement.readonly) throw new Error("Unexpected report write");
      return { success: true, results: statement.all(...values), meta: {} };
    },
    first: async () => {
      statements.push(sql);
      const statement = sqlite.prepare(sql);
      if (!statement.readonly) throw new Error("Unexpected report write");
      return statement.get(...values) ?? null;
    },
  });
  client = {
    prepare,
    batch: async (entries: any[]) =>
      entries.map(entry => {
        statements.push(entry.sql);
        const statement = sqlite.prepare(entry.sql);
        if (!statement.readonly) throw new Error("Unexpected report write");
        return {
          success: true,
          results: statement.all(...entry.values),
          meta: {},
        };
      }),
  } as unknown as D1Database;
});
afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

describe("customer report actual SQL and complete evidence", () => {
  it("separates restricted login from recorded entitlements without projecting restriction details", async () => {
    sqlite.exec(
      "UPDATE users SET login_blocked_at='2026-11-01',login_block_reason='PRIVATE_REASON',login_blocked_by=100 WHERE id=1"
    );
    const result = await readCustomerReport(client, scope, {
      ...filter,
      search: "customer1@",
    });
    const row = result.items[0];
    expect(row.loginRestricted).toBe(true);
    expect(
      row.services.find(service => service.kind === "package")?.status
    ).toBe("active");
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_REASON|login_blocked_at|login_block_reason|login_blocked_by/
    );
    expect(statements.join("\n")).not.toMatch(
      /login_block_reason|login_blocked_by/
    );
    expect(
      customerExportTable([row], ["services"], "en", false).body[0][0]
    ).toContain("Login restricted");
    expect(
      customerExportTable([row], ["services"], "ar", false).body[0][0]
    ).toContain("تسجيل الدخول مقيّد");
    expect(
      (await readCustomerReport(client, scope, filter)).items.every(
        item => item.loginRestricted === false
      )
    ).toBe(true);
  });
  it("traverses every account exactly once with deterministic ties, no staff or credential projections", async () => {
    const ids: number[] = [];
    for (let page = 1; page <= 4; page++) {
      const result = await readCustomerReport(client, scope, {
        ...filter,
        page,
      });
      expect(result.total).toBe(65);
      expect(result.accountCount).toBe(65);
      expect(result.items.length).toBeLessThanOrEqual(20);
      ids.push(...result.items.map(row => row.id));
    }
    expect(ids).toEqual(Array.from({ length: 65 }, (_, i) => 65 - i));
    expect(new Set(ids).size).toBe(65);
    expect(statements.join("\n")).not.toMatch(
      /passwordHash|keyCode|trading_account_ref|financial_ledger_entries|SELECT \*/
    );
  });
  it("orders mixed SQL/ISO registration times chronologically using the expression index", async () => {
    sqlite.exec(
      "UPDATE users SET createdAt='2026-11-27 23:00:00' WHERE id=1; UPDATE users SET createdAt='2026-11-27T01:00:00Z' WHERE id=2;"
    );
    const result = await readCustomerReport(client, scope, filter);
    expect(result.items.slice(0, 2).map(row => row.id)).toEqual([1, 2]);
    const plan = sqlite
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM users u WHERE u.isStaff=0 ORDER BY julianday(u.createdAt) DESC,u.id DESC LIMIT 20"
      )
      .all();
    expect(JSON.stringify(plan)).toContain("idx_users_customer_registered");
    expect(JSON.stringify(plan)).not.toContain("TEMP B-TREE");
  });
  it("merges exact country aliases without rewriting rows and flags cities used as countries", async () => {
    sqlite.exec(
      "UPDATE users SET country='Nablus' WHERE id=3; UPDATE users SET country='Germany' WHERE id=4"
    );
    const result = await readCustomerReport(client, scope, {
      ...filter,
      country: "code:PS",
      exportAll: true,
    });
    expect(result.total).toBe(63);
    expect(result.items).toHaveLength(63);
    expect(result.countries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "code:DE", needsReview: false }),
        expect.objectContaining({ value: "raw:Nablus", needsReview: true }),
      ])
    );
    expect(
      sqlite.prepare("SELECT country FROM users WHERE id=3").get()
    ).toEqual({ country: "Nablus" });
    expect(
      (
        await readCustomerReport(client, scope, {
          ...filter,
          country: "raw:Nablus",
        })
      ).items.map(row => row.id)
    ).toEqual([3]);
  });
  it("searches literal percent/underscore/backslash and never broadens SQL from customer input", async () => {
    sqlite.exec("UPDATE users SET name='100%_\\Customer' WHERE id=1");
    for (const search of ["100%", "%_", "\\Customer"])
      expect(
        (
          await readCustomerReport(client, scope, { ...filter, search })
        ).items.map(row => row.id)
      ).toEqual([1]);
    expect(
      (
        await readCustomerReport(client, scope, {
          ...filter,
          search: "' OR 1=1 --",
        })
      ).total
    ).toBe(0);
  });
  it("sorts country aliases together by their English display name, including filtered exports", async () => {
    sqlite.exec("UPDATE users SET country='Germany' WHERE id IN(1,2)");
    const result = await readCustomerReport(client, scope, {
      ...filter,
      sort: "country",
      direction: "asc",
      exportAll: true,
    });
    expect(result.items.slice(0, 2).map(row => row.id)).toEqual([1, 2]);
    expect(result.items.slice(2).map(row => row.id)).toEqual(
      Array.from({ length: 63 }, (_, index) => index + 3)
    );
  });
  it("batches accurate service state and historical activation counts, with no activation side effects", async () => {
    const result = await readCustomerReport(client, scope, {
      ...filter,
      search: "customer1@",
    });
    const row = result.items[0];
    expect(row.totalKeys).toBe(1);
    expect(row.renewalCount).toBe(1);
    expect(row.services.map(service => [service.kind, service.status])).toEqual(
      [
        ["package", "active"],
        ["lexai", "pending"],
        ["recommendations", "paused"],
        ["copier", "active"],
      ]
    );
    expect(
      (
        await readCustomerReport(client, scope, {
          ...filter,
          search: "customer2@",
        })
      ).items[0].services[0].status
    ).toBe("expired");
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_/);
    const plan = sqlite
      .prepare(
        "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM registrationKeys WHERE lower(trim(email))='customer1@example.invalid' AND packageId IS NOT NULL AND activatedAt IS NOT NULL"
      )
      .all();
    expect(JSON.stringify(plan)).toContain(
      "idx_registration_keys_customer_activation"
    );
  });
  it("does not call an orphaned package subscription active", async () => {
    sqlite.exec(
      "INSERT INTO packageSubscriptions VALUES(3,3,999,1,'2026-01-01',NULL)"
    );
    const result = await readCustomerReport(client, scope, {
      ...filter,
      search: "customer3@",
    });
    expect(result.items[0].services[0]).toMatchObject({
      nameEn: "Unknown package",
      status: "unknown",
    });
  });
  it("sorts complete corrected lifetime money before paging rather than sorting a page or list prices", async () => {
    const result = await readCustomerReport(client, scope, {
      ...filter,
      sort: "paid",
      includePayments: true,
    });
    expect(result.items.slice(0, 2).map(row => row.id)).toEqual([2, 1]);
    expect(result.items[1].paymentSummary).toMatchObject({
      netPaidMinor: 9000,
      receiptsMinor: 9000,
      coverage: "needs_reconciliation",
    });
    expect(
      statements.filter(sql => /FROM financial_ledger_entries/.test(sql))
    ).toHaveLength(1);
  });
  it("keeps payment permission metadata even for empty populations and excludes unauthorized amounts", async () => {
    const result = await readCustomerReport(
      client,
      { ...scope, canViewClientPayments: false, accessVersion: "operations" },
      { ...filter, search: "no match", includePayments: true }
    );
    expect(result).toMatchObject({
      items: [],
      paymentsIncluded: false,
      canViewClientPayments: false,
      viewerId: 1,
    });
    expect(statements.join("\n")).not.toContain("financial_ledger_entries");
    await expect(
      readCustomerReport(
        client,
        { ...scope, canViewClientPayments: false },
        { ...filter, sort: "paid", includePayments: true }
      )
    ).rejects.toThrow("authorized payments");
  });
  it("fails closed for evidence failure and never sorts unavailable money as zero", async () => {
    sqlite.exec("DROP TABLE financial_ledger_entries");
    const result = await readCustomerReport(client, scope, {
      ...filter,
      includePayments: true,
      search: "customer1@",
    });
    expect(result.items[0].paymentSummary).toMatchObject({
      coverage: "unavailable",
      netPaidMinor: null,
    });
    await expect(
      readCustomerReport(client, scope, {
        ...filter,
        includePayments: true,
        sort: "paid",
      })
    ).rejects.toThrow("Complete payment evidence is unavailable");
  });
  it("rejects oversized exports instead of silently exporting the first 5,000 accounts", async () => {
    const insert = sqlite.prepare(
      "INSERT INTO users(id,email,isStaff,createdAt) VALUES(?,?,0,?)"
    );
    sqlite.transaction(() => {
      for (let id = 200; id < 5200; id++)
        insert.run(id, `account${id}@example.invalid`, "2026-11-01");
    })();
    await expect(
      readCustomerReport(client, scope, { ...filter, exportAll: true })
    ).rejects.toThrow("no partial export");
  });
  it("uses indexed batched service lookups and idempotent additive migration bookkeeping", () => {
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
    ).toEqual({ count: 1 });
    for (const [table, field, expected] of [
      ["packageSubscriptions", "userId", "idx_package_subscriptions_customer"],
      ["lexaiSubscriptions", "userId", "idx_lexai_subscriptions_customer"],
      [
        "recommendationSubscriptions",
        "userId",
        "idx_recommendationSubscriptions_userId",
      ],
      [
        "trade_copier_subscriptions",
        "user_id",
        "idx_trade_copier_subscriptions_user_status",
      ],
    ]) {
      expect(
        JSON.stringify(
          sqlite
            .prepare(
              `EXPLAIN QUERY PLAN SELECT id FROM ${table} WHERE ${field} IN (SELECT value FROM json_each('[1,2]'))`
            )
            .all()
        )
      ).toContain(expected);
    }
  });
});

describe("location, dates, service states and safe consistent exports", () => {
  it("accepts country identifiers and exact aliases while preserving foreign and unknown historical entries", () => {
    expect(CUSTOMER_COUNTRY_CODES.length).toBe(249);
    for (const [raw, code] of [
      [" PS ", "PS"],
      ["فلسطين", "PS"],
      ["Palestine", "PS"],
      ["Germany", "DE"],
      ["Deutschland", null],
      ["الأردن", "JO"],
      ["نابلس", null],
    ])
      expect(customerCountryCode(raw)).toBe(code);
    expect(customerCountryDisplay("Nablus", "ar")).toMatchObject({
      label: "Nablus",
      needsReview: true,
    });
    expect(customerCountryDisplay("PS", "ar").label).toBe("فلسطين");
  });
  it.each(["Nablus", "نابلس", "St. John's", "6 أكتوبر", "北京"])(
    "accepts city %s",
    city => expect(isValidCustomerCity(city)).toBe(true)
  );
  it.each([
    "",
    "123456",
    "https://example.com",
    "a@b.com",
    "<script>",
    "Nablus\ncity",
    "a".repeat(101),
  ])("rejects malformed city %s", city =>
    expect(isValidCustomerCity(city)).toBe(false)
  );
  it("treats unzoned stored SQL times as UTC and invalid legacy literals as unknown", () => {
    expect(customerReportDate("2026-11-27 10:00:00")?.toISOString()).toBe(
      "2026-11-27T10:00:00.000Z"
    );
    expect(customerReportDate("CURRENT_TIMESTAMP")).toBeNull();
  });
  it.each([
    [{ kind: "package", isActive: 1, endDate: null }, "active"],
    [{ kind: "lexai", isActive: 1, endDate: null }, "unknown"],
    [{ isActive: 1, endDate: "bad" }, "unknown"],
    [
      {
        isActive: 1,
        endDate: "2026-01-01",
        isPaused: 1,
        pausedRemainingDays: 20,
      },
      "paused",
    ],
    [{ isActive: 1, endDate: "2026-01-01", isPendingActivation: 1 }, "pending"],
    [{ isActive: 0, endDate: "2027-01-01" }, "inactive"],
    [{ isActive: 1, endDate: "2026-11-27T12:00:00Z" }, "expired"],
    [{ kind: "copier", status: "awaiting_external_link" }, "pending"],
    [{ kind: "copier", status: "suspended", endDate: "2026-01-01" }, "paused"],
    [{ kind: "copier", status: "active", endDate: "2026-11-28" }, "expiring"],
  ] as const)("classifies %j as %s", (row, expected) =>
    expect(customerServiceState(row, Date.now())).toBe(expected)
  );
  it("escapes quoted/multiline text, whitespace-prefixed formulas and phone numbers without corrupting numeric amounts", () => {
    expect(customerCsvCell('a,"b"\nnext')).toBe('"a,""b""\nnext"');
    for (const value of ["=1+1", " \t=1+1", "\r@command", "+123", "-formula"])
      expect(customerCsvCell(value)).toBe(`"'${value}"`);
    expect(customerCsvCell({ text: "001234" })).toBe('"\'001234"');
    expect(customerCsvCell(-12.5)).toBe("-12.5");
  });
  it("uses exactly selected authorized columns in both formats and escapes print markup", () => {
    const row: CustomerReportRow = {
      id: 1,
      name: "<img src=x onerror=alert(1)>",
      email: "a@example.invalid",
      phone: "+9700",
      city: "PRIVATE_CITY",
      country: "PS",
      createdAt: null,
      loginRestricted: false,
      totalKeys: 1,
      renewalCount: 1,
      services: [],
    };
    const table = customerExportTable([row], ["name", "paid"], "en", false);
    expect(table.headers).toEqual(["Name"]);
    expect(table.body[0]).toHaveLength(1);
    expect(
      buildCustomerReportCsv(table, [["Applied search", "=formula"]])
    ).not.toMatch(/PRIVATE_CITY|9700|Lifetime/);
    const printed = buildCustomerReportPrint(
      table,
      [["Scope", "Current page"]],
      "en"
    );
    expect(printed).toContain("&lt;img");
    expect(printed).not.toContain("<img");
    expect(printed).not.toContain("PRIVATE_CITY");
  });
});

describe("bounded student directory and complete totals", () => {
  it("filters across all accounts, batches page details, and keeps package flags separate from current expiry", async () => {
    sqlite.exec(
      "INSERT INTO enrollments VALUES(1,1,1,1,100); UPDATE users SET lastSignedIn='2026-11-27 11:00:00',brokerOnboardingComplete=1 WHERE id=1"
    );
    const result = await readStudentDirectory(client, scope, {
      ...filter,
      pageSize: 10,
      directory: { packageFilter: "active" },
    });
    expect(result.total).toBe(2);
    expect(result.accountCount).toBe(65);
    expect(result.markedActiveAccounts).toBe(2);
    const first = result.items.find(row => row.id === 1)!;
    expect(first).toMatchObject({
      isAdminSkipped: true,
      courseProgress: 100,
      brokerOnboardingComplete: 1,
      activePackages: ["Comprehensive"],
    });
    const expired = result.items.find(row => row.id === 2)!;
    expect(expired.activePackages).toEqual(["Comprehensive"]);
    expect(expired.services[0].status).toBe("expired");
    expect(
      (
        await readStudentDirectory(client, scope, {
          ...filter,
          directory: { packageFilter: "none" },
        })
      ).total
    ).toBe(63);
    expect(statements.join("\n")).not.toMatch(
      /passwordHash|SELECT \*|financial_ledger_entries/
    );
  });
  it("sorts sign-in time and package counts before paging, preserving legacy dates as UTC", async () => {
    sqlite.exec(
      "UPDATE users SET lastSignedIn='2026-11-27T01:00:00Z' WHERE id=2;UPDATE users SET lastSignedIn='2026-11-27 23:00:00' WHERE id=1"
    );
    const result = await readStudentDirectory(client, scope, {
      ...filter,
      pageSize: 10,
      directory: { packageFilter: "all", sort: "lastSignIn" },
    });
    expect(result.items.slice(0, 2).map(row => row.id)).toEqual([1, 2]);
    expect(
      (
        await readStudentDirectory(client, scope, {
          ...filter,
          directory: { packageFilter: "all", sort: "package" },
        })
      ).items
        .slice(0, 2)
        .map(row => row.id)
    ).toEqual([2, 1]);
  });
  it("totals complete lifetime evidence for all filtered accounts rather than the visible page", async () => {
    const result = await readStudentDirectory(client, scope, {
      ...filter,
      includePayments: true,
      pageSize: 10,
      directory: { packageFilter: "all", includePaymentTotal: true },
    });
    expect(result.items).toHaveLength(10);
    expect(result.items.every(row => row.id > 2)).toBe(true);
    expect(result.filteredPaymentTotalMinor).toBe(29000);
    expect(
      statements.filter(sql => /FROM financial_ledger_entries/.test(sql))
    ).toHaveLength(1);
    expect(
      (
        await readStudentDirectory(client, scope, {
          ...filter,
          search: "customer1@",
          includePayments: true,
          directory: { packageFilter: "all", includePaymentTotal: true },
        })
      ).filteredPaymentTotalMinor
    ).toBe(9000);
  });
  it("keeps unavailable totals unknown and refuses unavailable financial ordering", async () => {
    sqlite.exec("DROP TABLE financial_ledger_entries");
    const result = await readStudentDirectory(client, scope, {
      ...filter,
      includePayments: true,
      directory: { packageFilter: "all", includePaymentTotal: true },
    });
    expect(result.filteredPaymentTotalMinor).toBeNull();
    await expect(
      readStudentDirectory(client, scope, {
        ...filter,
        includePayments: true,
        sort: "paid",
        directory: { packageFilter: "all" },
      })
    ).rejects.toThrow("Complete payment evidence is unavailable");
  });
  it("does not truncate a financial total to the first5,000 identities or block ordinary contact paging", async () => {
    const insert = sqlite.prepare(
      "INSERT INTO users(id,email,isStaff,createdAt) VALUES(?,?,0,?)"
    );
    sqlite.transaction(() => {
      for (let id = 200; id < 5200; id++)
        insert.run(id, "synthetic" + id + "@example.invalid", "2026-11-27");
    })();
    const result = await readStudentDirectory(client, scope, {
      ...filter,
      includePayments: true,
      directory: { packageFilter: "all", includePaymentTotal: true },
    });
    expect(result.total).toBe(5065);
    expect(result.items).toHaveLength(20);
    expect(result.filteredPaymentTotalMinor).toBeNull();
  });
  it("exports only selected authorized directory columns, keeping last sign-in and marked packages distinct", async () => {
    const result = await readStudentDirectory(client, scope, {
        ...filter,
        search: "customer1@",
        directory: { packageFilter: "all" },
      }),
      row = result.items[0];
    const table = studentDirectoryExportTable(
      [row],
      ["name", "package", "lastSignIn"],
      "en",
      false
    );
    expect(table.headers).toEqual([
      "Name",
      "Packages marked active",
      "Last sign in",
    ]);
    expect(table.body[0]).toEqual(["Customer 1", "Comprehensive", ""]);
    expect(buildCustomerReportCsv(table, [])).not.toContain("9700");
    expect(
      studentDirectoryExportTable([row], ["spent"], "en", false).headers
    ).toEqual([]);
  });
});

it("sorts directory location by recorded city and canonical English country names before paging", async () => {
  sqlite.exec(
    "UPDATE users SET city='Same';UPDATE users SET country='Germany' WHERE id=1;UPDATE users SET country='DE' WHERE id=2;UPDATE users SET country='France' WHERE id=3;UPDATE users SET country='FR' WHERE id=4"
  );
  const result = await readStudentDirectory(client, scope, {
    ...filter,
    direction: "asc",
    pageSize: 10,
    directory: { packageFilter: "all", sort: "location" },
  });
  expect(result.items.slice(0, 4).map(row => row.id)).toEqual([3, 4, 1, 2]);
  expect(result.items.slice(4).map(row => row.id)).toEqual([5, 6, 7, 8, 9, 10]);
});
