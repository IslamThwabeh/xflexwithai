import { sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  NAVIGATION_ANNOUNCEMENT_ID,
  shouldShowInterfaceAnnouncement,
  type InterfaceAnnouncementAction,
} from "../../shared/interfaceAnnouncement";

export async function getInterfaceAnnouncementStatus(
  accountId: number,
  login: string
) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const row = await database.get<{
    dismissed_at: string | null;
    deferred_login: string | null;
  }>(sql`
    SELECT dismissed_at, deferred_login FROM interface_announcement_states
    WHERE announcement_id = ${NAVIGATION_ANNOUNCEMENT_ID} AND account_id = ${accountId}
  `);
  const state = row
    ? { dismissedAt: row.dismissed_at, deferredLogin: row.deferred_login }
    : null;
  return {
    id: NAVIGATION_ANNOUNCEMENT_ID,
    visible: shouldShowInterfaceAnnouncement(state, login),
  };
}

export async function recordInterfaceAnnouncementAction(
  accountId: number,
  login: string,
  action: InterfaceAnnouncementAction
) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const now = new Date().toISOString();
  const dismissedAt = action === "dismiss" ? now : null;
  const deferredLogin = action === "later" ? login : null;
  // Dismissal is monotonic, including when a stale tab submits a later action.
  await database.run(sql`
    INSERT INTO interface_announcement_states
      (announcement_id, account_id, dismissed_at, deferred_login, updated_at)
    VALUES (${NAVIGATION_ANNOUNCEMENT_ID}, ${accountId}, ${dismissedAt}, ${deferredLogin}, ${now})
    ON CONFLICT (announcement_id, account_id) DO UPDATE SET
      dismissed_at = excluded.dismissed_at,
      deferred_login = excluded.deferred_login,
      updated_at = excluded.updated_at
    WHERE interface_announcement_states.dismissed_at IS NULL
  `);
  return { id: NAVIGATION_ANNOUNCEMENT_ID, visible: false };
}
