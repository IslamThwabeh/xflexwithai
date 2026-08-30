import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS,
  LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS,
} from "../shared/livePackageOwnerReview";

const migration = readFileSync(new URL("../database/migrations/093_live_package_owner_review.sql", import.meta.url), "utf8");
const router = readFileSync(new URL("../backend/routers.ts", import.meta.url), "utf8");
const database = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");
const reviewPage = readFileSync(new URL("../frontend/src/pages/AdminLivePackageReview.tsx", import.meta.url), "utf8");

describe("Live Package owner review", () => {
  it("applies cleanly and preserves an append-only revision history", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("CREATE TABLE admins (id INTEGER PRIMARY KEY);");
    sqlite.exec(migration);
    sqlite.prepare("INSERT INTO live_package_owner_answer_history (question_id, answer_text) VALUES (?, ?)").run("price_vat", "approved");
    expect(() => sqlite.prepare("UPDATE live_package_owner_answer_history SET answer_text = ? WHERE question_id = ?").run("changed", "price_vat")).toThrow(/append-only/);
    expect(() => sqlite.prepare("DELETE FROM live_package_owner_answer_history WHERE question_id = ?").run("price_vat")).toThrow(/append-only/);
    sqlite.close();
  });

  it("keeps the owner checklist short and requires every final decision", () => {
    expect(LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS).toHaveLength(10);
    expect(LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS).toHaveLength(10);
    expect(new Set(LIVE_PACKAGE_OWNER_REVIEW_REQUIRED_IDS).size).toBe(10);
  });

  it("autosaves current answers and inserts every saved revision", () => {
    expect(database).toContain("db.insert(livePackageOwnerAnswerHistory)");
    expect(database).toContain("status: \"draft\"");
    expect(reviewPage).toContain("setTimeout(() => void flush(), 900)");
    expect(reviewPage).toContain("لا تفعّل البكج أو تنشره تلقائياً");
  });

  it("exposes the review only through full-admin procedures", () => {
    const section = router.slice(router.indexOf("livePackageOwnerReview: router"), router.indexOf("// ============================================================================\n  // Admin Settings"));
    expect(section).toContain("get: adminProcedure");
    expect(section).toContain("save: adminProcedure");
    expect(section).toContain("submit: adminProcedure");
    expect(section).toContain("submit_live_package_owner_review");
  });
});
