import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SUPPORT_AI_ACADEMY_KNOWLEDGE } from "../backend/_core/supportAiKnowledge";

const routerSource = readFileSync(new URL("../backend/routers.ts", import.meta.url), "utf8");

describe("support AI current academy knowledge", () => {
  it("explains Live Package using approved, non-speculative facts", () => {
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("four live sessions weekly for three months");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("two educational sessions and two live trading/analysis sessions");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("₪2,000 for a new customer");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("₪1,000 for a customer whose latest qualifying previous package was Basic");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("₪350 for a customer whose latest qualifying previous package was Comprehensive");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("Never claim registration is currently open");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("never provide or invent a Zoom link");
    expect(routerSource).toContain('"live_package"');
  });

  it("covers recently added client self-service paths and their boundaries", () => {
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("Course Documents library at /documents");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("Free Starter Library");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("Order Details page while the order is awaiting confirmation");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("JPEG, PNG, WebP, HEIC, or PDF up to 10 MB");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("Support videos must be shorter than one minute");
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).toContain("deleted content cannot be restored");
  });

  it("does not expose internal Live operations or unsupported profit claims", () => {
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).not.toMatch(/targetSubscriberCount|cohortKey|purchaseApproved|adminVisible/);
    expect(SUPPORT_AI_ACADEMY_KNOWLEDGE).not.toMatch(/1,000.{0,12}2,000 points|profit statement/i);
  });
});
