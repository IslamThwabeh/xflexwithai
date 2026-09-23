import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/AdminEmailLogs.tsx", import.meta.url)),
  "utf8",
);
const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

describe("Admin Email Logs outbox-health polling", () => {
  it("polls the detailed health query every five minutes only while visible", () => {
    expect(source).toContain("const OUTBOX_HEALTH_REFRESH_MS = 5 * 60_000");
    expect(source).toContain("document.visibilityState === 'visible'");
    expect(source).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)");
    expect(source).toContain("document.removeEventListener('visibilitychange', handleVisibilityChange)");
    expect(source).toContain(
      "refetchInterval: isAdmin && isPageVisible ? OUTBOX_HEALTH_REFRESH_MS : false",
    );
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: true");
    expect(source).not.toContain("refetchInterval: 60000");
  });

  it("still refreshes detailed health immediately after a manual drain", () => {
    expect(source).toContain("utils.adminEmail.outboxHealth.invalidate()");
    expect(source).toContain("utils.adminEmail.deliveryLogs.invalidate()");
    expect(source).toContain("utils.adminEmail.deliveryLogSummary.invalidate()");
  });

  it("does not query delivery logs while an administrator types text filters", () => {
    expect(source).toContain("const [recipientQueryDraft, setRecipientQueryDraft] = useState('')");
    expect(source).toContain("const [deliveryEventTypeDraft, setDeliveryEventTypeDraft] = useState('')");
    expect(source).toContain("setRecipientQuery(recipientQueryDraft.trim())");
    expect(source).toContain("setDeliveryEventType(deliveryEventTypeDraft.trim())");
    expect(source).toContain("if (e.key === 'Enter') applyTextFilters()");
    expect(source).not.toContain("onChange={(e) => setRecipientQuery(e.target.value)}");
    expect(source).not.toContain("onChange={(e) => setDeliveryEventType(e.target.value)}");
  });

  it("defaults the audit page to seven days and uses indexed exact email matching", () => {
    expect(source).toContain("useState<DeliveryDatePreset>('last7')");
    expect(source).toContain("useState(() => getAmmanDateValue(-6))");
    expect(backendSource).toContain("eq(emailDeliveryLogs.recipientEmail, normalizedQuery)");
    expect(backendSource).toContain("isLikelyValidEmail(normalizedQuery)");
  });

  it("keeps the summary to one aggregate table scan", () => {
    const summarySection = backendSource.slice(
      backendSource.indexOf("export async function getEmailDeliveryLogSummary"),
      backendSource.indexOf("export async function getUsersForDripEmail"),
    );
    expect(summarySection).not.toContain("topEventsBase");
    expect(summarySection).not.toContain("topEventTypes");
  });
});
