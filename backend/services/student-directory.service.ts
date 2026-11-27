import type { D1Database } from "@cloudflare/workers-types";
import {
  readCustomerReport,
  CustomerReportError,
} from "./customer-report.service";
export async function readStudentDirectory(
  client: D1Database,
  scope: Parameters<typeof readCustomerReport>[1],
  input: Parameters<typeof readCustomerReport>[2]
) {
  const report = await readCustomerReport(client, scope, input),
    ids = JSON.stringify(report.items.map(row => row.id));
  const active =
    "EXISTS(SELECT 1 FROM packageSubscriptions s JOIN packages p ON p.id=s.packageId WHERE s.userId=u.id AND s.isActive=1)";
  const stats = await client
    .prepare(
      `SELECT COUNT(*) AS total,SUM(CASE WHEN ${active} THEN 1 ELSE 0 END) AS markedActive FROM users u WHERE u.isStaff=0`
    )
    .first<{ total: number; markedActive: number }>();
  if (!stats) throw new CustomerReportError("Student counts unavailable");
  const rows = report.items.length
    ? await client.batch([
        client
          .prepare(
            "SELECT id,emailVerified,lastSignedIn,brokerOnboardingComplete FROM users WHERE id IN(SELECT value FROM json_each(?))"
          )
          .bind(ids),
        client
          .prepare(
            "SELECT userId,isAdminSkipped,progressPercentage FROM enrollments WHERE courseId=1 AND userId IN(SELECT value FROM json_each(?)) LIMIT 5001"
          )
          .bind(ids),
        client
          .prepare(
            "SELECT s.userId,p.nameEn,p.nameAr FROM packageSubscriptions s JOIN packages p ON p.id=s.packageId WHERE s.isActive=1 AND s.userId IN(SELECT value FROM json_each(?)) ORDER BY s.id DESC LIMIT 5001"
          )
          .bind(ids),
      ])
    : [];
  if (rows.some(result => !result.success || result.results.length > 5000))
    throw new CustomerReportError(
      "Student details unavailable or exceed the safe source limit"
    );
  const users = new Map(
    (rows[0]?.results ?? []).map((row: any) => [row.id, row])
  );
  const enrollments = new Map(
    (rows[1]?.results ?? []).map((row: any) => [row.userId, row])
  );
  const packages = new Map<number, { en: string[]; ar: string[] }>();
  for (const row of (rows[2]?.results ?? []) as any[]) {
    const names = packages.get(row.userId) ?? { en: [], ar: [] };
    if (!names.en.includes(row.nameEn)) {
      names.en.push(row.nameEn);
      names.ar.push(row.nameAr ?? row.nameEn);
    }
    packages.set(row.userId, names);
  }
  if (report.items.some(row => !users.has(row.id)))
    throw new CustomerReportError(
      "Student population changed; refresh before reviewing"
    );
  return {
    ...report,
    markedActiveAccounts: stats.markedActive ?? 0,
    items: report.items.map(row => ({
      ...row,
      ...users.get(row.id),
      canViewClientPayments: report.canViewClientPayments,
      activePackages: packages.get(row.id)?.en ?? [],
      activePackagesAr: packages.get(row.id)?.ar ?? [],
      isAdminSkipped: !!enrollments.get(row.id)?.isAdminSkipped,
      courseProgress: enrollments.get(row.id)?.progressPercentage ?? 0,
    })),
  };
}
