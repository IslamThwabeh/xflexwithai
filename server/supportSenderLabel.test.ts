import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "backend/db.ts"), "utf8");
const translationsSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/contexts/LanguageContext.tsx"),
  "utf8",
);
const clientSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/SupportChat.tsx"),
  "utf8",
);
const staffSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/AdminSupport.tsx"),
  "utf8",
);

describe("support sender role labels", () => {
  it("uses the requested bilingual Support Team label", () => {
    expect(translationsSource.match(/'support\.agent': 'Support Team'/g)).toHaveLength(1);
    expect(translationsSource.match(/'support\.agent': 'فريق الدعم'/g)).toHaveLength(1);
    expect(translationsSource.match(/'admin\.support\.support': 'Support Team'/g)).toHaveLength(1);
    expect(translationsSource.match(/'admin\.support\.support': 'فريق الدعم'/g)).toHaveLength(1);
  });

  it("does not return personal sender names from support-message reads", () => {
    expect(dbSource).not.toContain("supportMessageWithSender");
    expect(dbSource).not.toContain('as("senderName")');
  });

  it("renders role labels in messages and reply previews", () => {
    expect(clientSource).not.toContain("getSupportStaffDisplayName");
    expect(staffSource).not.toContain("getSupportStaffDisplayName");
    expect(clientSource.match(/t\("support\.agent"\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(staffSource.match(/t\('admin\.support\.support'\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
