import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSupportStaffDisplayName } from "../frontend/src/lib/supportSenderName";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "backend/db.ts"), "utf8");
const clientSource = fs.readFileSync(path.resolve(process.cwd(), "frontend/src/pages/SupportChat.tsx"), "utf8");
const staffSource = fs.readFileSync(path.resolve(process.cwd(), "frontend/src/pages/AdminSupport.tsx"), "utf8");

describe("support staff sender names", () => {
  it("shows only the first and last profile names", () => {
    expect(getSupportStaffDisplayName("Mohammad Ahmad Saleh")).toBe("Mohammad Saleh");
    expect(getSupportStaffDisplayName("  أحمد   محمد   الخطيب  ")).toBe("أحمد الخطيب");
    expect(getSupportStaffDisplayName("Rami")).toBe("Rami");
    expect(getSupportStaffDisplayName(null)).toBeNull();
  });

  it("loads support-agent names server-side without exposing shared admin identities", () => {
    expect(dbSource.match(/select\(supportMessageWithSender\)/g)).toHaveLength(3);
    expect(dbSource.match(/leftJoin\(users, eq\(supportMessages\.senderId, users\.id\)\)/g)).toHaveLength(3);
    expect(dbSource).toContain("senderType} = 'support'");
    expect(dbSource).not.toContain("senderType} IN ('support', 'admin')");
  });

  it("renders names on support replies while keeping admins role-labelled", () => {
    for (const source of [clientSource, staffSource]) {
      expect(source).toContain("getSupportStaffDisplayName");
      expect(source).toContain('msg.senderType === "support"');
      expect(source).toContain("!isBot");
      expect(source).toContain("previousSenderDisplayName !== senderDisplayName");
    }

    expect(clientSource).toContain('? t("support.admin")');
    expect(staffSource).toContain("? t('admin.support.admin')");
  });
});
