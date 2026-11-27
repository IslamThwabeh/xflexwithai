import type { D1Database } from "@cloudflare/workers-types";
import {
  CUSTOMER_REPORT_SORTS,
  customerServiceState,
  type CustomerReportFilter,
  type CustomerReportPage,
  type CustomerReportRow,
  type CustomerService,
} from "../../shared/customerReport";
import {
  customerCountryCode,
  customerCountryDisplay,
} from "../../shared/customerLocation";
import {
  isAvailableClientPaymentSummary,
  unavailableClientPaymentSummary,
} from "../../shared/clientPaymentSummary";
import { readClientPaymentSummaries } from "./client-payment-summary.service";

const SOURCE_LIMIT = 5000;
export class CustomerReportError extends Error {}
const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, character => "\\" + character);
const userProjection =
  "u.id,u.name,u.email,u.phone,u.city,u.country,u.createdAt,(u.login_blocked_at IS NOT NULL) AS loginRestricted";
type Scope = {
  viewerId: number;
  accessVersion: string;
  canViewClientPayments: boolean;
  paymentsEnabled: boolean;
};
export async function readCustomerReport(
  client: D1Database,
  scope: Scope,
  input: Omit<CustomerReportFilter, "pageSize"> & {
    pageSize: 10 | 20 | 25 | 50;
    includePayments: boolean;
    exportAll?: boolean;
    directory?: {
      packageFilter: "all" | "active" | "none";
      sort?: "package" | "lastSignIn" | "location";
      includePaymentTotal?: boolean;
    };
  }
): Promise<CustomerReportPage> {
  if (
    !scope.viewerId ||
    !scope.accessVersion ||
    !CUSTOMER_REPORT_SORTS.includes(input.sort)
  )
    throw new CustomerReportError("Invalid report scope");
  if (
    input.sort === "paid" &&
    (!scope.canViewClientPayments || !input.includePayments)
  )
    throw new CustomerReportError(
      "Show authorized payments before sorting by them"
    );
  const generatedAt = new Date().toISOString();
  const countryResult = await client
    .prepare(
      "SELECT country,COUNT(*) AS count FROM users WHERE isStaff=0 GROUP BY country LIMIT 502"
    )
    .all<{ country: string | null; count: number }>();
  if (!countryResult.success || countryResult.results.length > 501)
    throw new CustomerReportError(
      "Country sources exceed the safe report limit"
    );
  const rawCountries = countryResult.results;
  const accountCount = rawCountries.reduce((sum, row) => sum + row.count, 0);
  const countryMap = new Map<string, CustomerReportPage["countries"][number]>();
  for (const row of rawCountries) {
    if (!row.country?.trim()) continue;
    const en = customerCountryDisplay(row.country, "en"),
      ar = customerCountryDisplay(row.country, "ar");
    const value = en.code ? `code:${en.code}` : `raw:${row.country}`;
    countryMap.set(value, {
      value,
      labelEn: en.label,
      labelAr: ar.label,
      needsReview: en.needsReview,
    });
  }
  const countries = [...countryMap.values()].sort((a, b) =>
    a.labelEn.localeCompare(b.labelEn)
  );
  const where = ["u.isStaff=0"],
    bindings: (string | number)[] = [];
  if (input.search) {
    where.push(
      "(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.phone LIKE ? ESCAPE '\\' OR u.city LIKE ? ESCAPE '\\')"
    );
    const term = `%${escapeLike(input.search)}%`;
    bindings.push(term, term, term, term);
  }
  if (input.country) {
    const values = rawCountries
      .filter(row =>
        input.country.startsWith("code:")
          ? customerCountryCode(row.country) === input.country.slice(5)
          : input.country === `raw:${row.country}`
      )
      .map(row => row.country!);
    if (values.length > 80)
      throw new CustomerReportError(
        "Too many historical aliases; narrow this report by search"
      );
    if (values.length) {
      where.push(`u.country IN (${values.map(() => "?").join(",")})`);
      bindings.push(...values);
    } else where.push("0=1");
  }
  const markedPackage =
    "EXISTS(SELECT 1 FROM packageSubscriptions ds JOIN packages dp ON dp.id=ds.packageId WHERE ds.userId=u.id AND ds.isActive=1)";
  if (input.directory?.packageFilter === "active") where.push(markedPackage);
  if (input.directory?.packageFilter === "none")
    where.push("NOT " + markedPackage);
  const predicate = where.join(" AND ");
  const keyCount = (renewals: boolean) =>
    `(SELECT COUNT(*) FROM registrationKeys k WHERE lower(trim(k.email))=lower(trim(u.email)) AND k.packageId IS NOT NULL AND k.activatedAt IS NOT NULL${renewals ? " AND k.isRenewal=1" : ""})`;
  const sorts: Record<string, string> = {
    registered: "julianday(u.createdAt)",
    name: "u.name COLLATE NOCASE",
    email: "u.email COLLATE NOCASE",
    city: "u.city COLLATE NOCASE",
    country:
      "COALESCE((SELECT value FROM json_each(?) WHERE key=u.country),u.country) COLLATE NOCASE",
    keys: keyCount(false),
    renewals: keyCount(true),
  };
  if (input.directory?.sort === "package")
    sorts.registered =
      "(SELECT COUNT(DISTINCT p.nameEn) FROM packageSubscriptions s JOIN packages p ON p.id=s.packageId WHERE s.userId=u.id AND s.isActive=1)";
  if (input.directory?.sort === "lastSignIn")
    sorts.registered = "julianday(u.lastSignedIn)";
  if (input.directory?.sort === "location")
    sorts.registered =
      "COALESCE(u.city,'')||', '||COALESCE((SELECT value FROM json_each(?) WHERE key=u.country),u.country,'') COLLATE NOCASE";
  const direction = input.direction === "asc" ? "ASC" : "DESC";
  const order = `${sorts[input.sort] ?? "julianday(u.createdAt)"} ${direction},u.id ${direction}`;
  const sortBindings =
    input.sort === "country" || input.directory?.sort === "location"
      ? [
          JSON.stringify(
            Object.fromEntries(
              rawCountries
                .filter(row => row.country != null)
                .map(row => [
                  row.country,
                  customerCountryDisplay(row.country, "en").label,
                ])
            )
          ),
        ]
      : [];
  const countResult = await client
    .prepare(`SELECT COUNT(*) AS count FROM users u WHERE ${predicate}`)
    .bind(...bindings)
    .first<{ count: number }>();
  if (!countResult || !Number.isSafeInteger(countResult.count))
    throw new CustomerReportError("Customer count unavailable");
  const total = countResult.count;
  if (input.exportAll && total > SOURCE_LIMIT)
    throw new CustomerReportError(
      "The export exceeds 5,000 accounts. Narrow the filters; no partial export was produced."
    );
  const pageSize = input.exportAll
    ? SOURCE_LIMIT
    : Math.min(50, Math.max(1, input.pageSize));
  const page = input.exportAll
    ? 1
    : Math.max(
        1,
        Math.min(input.page, Math.max(1, Math.ceil(total / pageSize)))
      );
  let paymentSummaries:
    | Awaited<ReturnType<typeof readClientPaymentSummaries>>["summaries"]
    | null = null;
  let paidIds: number[] | null = null;
  let filteredPaymentTotalMinor: number | null = null;
  const wantsTotal =
    !!input.directory?.includePaymentTotal &&
    input.includePayments &&
    scope.canViewClientPayments;
  if (input.sort === "paid" || wantsTotal) {
    const identities = await client
      .prepare(
        `SELECT u.id,u.email FROM users u WHERE ${predicate} ORDER BY u.id LIMIT ?`
      )
      .bind(...bindings, SOURCE_LIMIT + 1)
      .all<{ id: number; email: string }>();
    if (!identities.success)
      throw new CustomerReportError("Customer payment population unavailable");
    const complete = identities.results.length <= SOURCE_LIMIT;
    if (input.sort === "paid" && !complete)
      throw new CustomerReportError(
        "Payment sorting exceeds 5,000 accounts; narrow the filters."
      );
    if (complete && scope.paymentsEnabled)
      paymentSummaries = identities.results.length
        ? (await readClientPaymentSummaries(client, identities.results))
            .summaries
        : new Map();
    const available =
      complete &&
      scope.paymentsEnabled &&
      identities.results.every(row =>
        isAvailableClientPaymentSummary(paymentSummaries?.get(row.id))
      );
    if (input.sort === "paid" && !available)
      throw new CustomerReportError(
        "Complete payment evidence is unavailable; choose another sort."
      );
    if (wantsTotal && available) {
      const sum = identities.results.reduce(
        (total, row) => total + paymentSummaries!.get(row.id)!.netPaidMinor!,
        0
      );
      filteredPaymentTotalMinor = Number.isSafeInteger(sum) ? sum : null;
    }
    if (input.sort === "paid")
      paidIds = identities.results
        .map(row => row.id)
        .sort(
          (a, b) =>
            (paymentSummaries!.get(a)!.netPaidMinor! -
              paymentSummaries!.get(b)!.netPaidMinor! || a - b) *
            (direction === "ASC" ? 1 : -1)
        )
        .slice((page - 1) * pageSize, page * pageSize);
  }
  // A page contains contacts only for the requested customers. No password,
  // credential, receipt URL or internal subscription notes are projected.
  const usersResult = paidIds
    ? await client
        .prepare(
          `SELECT ${userProjection} FROM users u WHERE u.isStaff=0 AND u.id IN (SELECT value FROM json_each(?))`
        )
        .bind(JSON.stringify(paidIds))
        .all<CustomerReportRow>()
    : await client
        .prepare(
          `SELECT ${userProjection} FROM users u WHERE ${predicate} ORDER BY ${order} LIMIT ? OFFSET ?`
        )
        .bind(...bindings, ...sortBindings, pageSize, (page - 1) * pageSize)
        .all<CustomerReportRow>();
  if (!usersResult.success)
    throw new CustomerReportError("Customer page unavailable");
  const users = usersResult.results;
  if (paidIds) {
    const positions = new Map(paidIds.map((id, index) => [id, index]));
    users.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
  }
  if (input.exportAll && users.length !== total)
    throw new CustomerReportError(
      "The customer population changed; refresh before exporting."
    );
  const ids = JSON.stringify(users.map(row => row.id));
  const emails = JSON.stringify(
    users.map(row => row.email.trim().toLowerCase())
  );
  const statements = [
    `SELECT lower(trim(email)) AS email,COUNT(*) AS totalKeys,SUM(CASE WHEN isRenewal=1 THEN 1 ELSE 0 END) AS renewalCount FROM registrationKeys WHERE lower(trim(email)) IN (SELECT value FROM json_each(?)) AND packageId IS NOT NULL AND activatedAt IS NOT NULL GROUP BY lower(trim(email)) LIMIT ${SOURCE_LIMIT + 1}`,
    `SELECT s.userId,'package' AS kind,p.nameEn,p.nameAr,s.isActive,s.startDate,s.endDate FROM packageSubscriptions s LEFT JOIN packages p ON p.id=s.packageId WHERE s.userId IN (SELECT value FROM json_each(?)) ORDER BY s.id DESC LIMIT ${SOURCE_LIMIT + 1}`,
    ...(["lexaiSubscriptions", "recommendationSubscriptions"] as const).map(
      (table, i) =>
        `SELECT s.userId,'${i === 0 ? "lexai" : "recommendations"}' AS kind,s.isActive,s.isPaused,s.pausedRemainingDays,s.isPendingActivation,s.startDate,s.endDate FROM ${table} s WHERE s.userId IN (SELECT value FROM json_each(?)) ORDER BY s.id DESC LIMIT ${SOURCE_LIMIT + 1}`
    ),
    `SELECT user_id AS userId,'copier' AS kind,status,starts_at AS startDate,ends_at AS endDate FROM trade_copier_subscriptions WHERE user_id IN (SELECT value FROM json_each(?)) ORDER BY id DESC LIMIT ${SOURCE_LIMIT + 1}`,
  ];
  const results = users.length
    ? await client.batch(
        statements.map((statement, index) =>
          client.prepare(statement).bind(index === 0 ? emails : ids)
        )
      )
    : [];
  if (
    results.some(
      result => !result.success || result.results.length > SOURCE_LIMIT
    )
  )
    throw new CustomerReportError(
      "Service history exceeds the safe source limit; narrow the filters."
    );
  const keys = new Map(
    (results[0]?.results ?? []).map((row: any) => [row.email, row])
  );
  const services = new Map<number, CustomerService[]>();
  const fixedNames = {
    lexai: ["LexAI", "LexAI"],
    recommendations: ["Recommendations", "التوصيات"],
    copier: ["Trade Copier", "ناسخ الصفقات"],
  };
  const now = Date.parse(generatedAt);
  for (const result of results.slice(1))
    for (const row of result.results as any[]) {
      const names =
        row.kind === "package"
          ? [row.nameEn ?? "Unknown package", row.nameAr ?? "باقة غير معروفة"]
          : fixedNames[row.kind as keyof typeof fixedNames];
      const service: CustomerService = {
        kind: row.kind,
        nameEn: names[0],
        nameAr: names[1],
        status:
          row.kind === "package" && !row.nameEn && !row.nameAr
            ? "unknown"
            : customerServiceState(row, now),
        endDate: row.endDate ?? null,
      };
      const current = services.get(row.userId) ?? [];
      // Preserve materially different states/names, but don't print repeated
      // historical renewals as separate current subscriptions.
      if (
        !current.some(
          saved =>
            saved.kind === service.kind &&
            saved.nameEn === service.nameEn &&
            saved.status === service.status
        )
      )
        current.push(service);
      services.set(row.userId, current);
    }
  const paymentsIncluded = input.includePayments && scope.canViewClientPayments;
  if (
    paymentsIncluded &&
    !paymentSummaries &&
    users.length &&
    scope.paymentsEnabled
  )
    paymentSummaries = (await readClientPaymentSummaries(client, users))
      .summaries;
  return {
    items: users.map(user => ({
      ...user,
      loginRestricted: Boolean(user.loginRestricted),
      totalKeys: Number(
        keys.get(user.email.trim().toLowerCase())?.totalKeys ?? 0
      ),
      renewalCount: Number(
        keys.get(user.email.trim().toLowerCase())?.renewalCount ?? 0
      ),
      services: services.get(user.id) ?? [],
      ...(paymentsIncluded
        ? {
            paymentSummary:
              paymentSummaries?.get(user.id) ??
              unavailableClientPaymentSummary(generatedAt),
          }
        : {}),
    })),
    total,
    accountCount,
    page,
    pageSize: input.exportAll ? users.length : pageSize,
    generatedAt,
    countries,
    ...(input.directory ? { filteredPaymentTotalMinor } : {}),
    canViewClientPayments: scope.canViewClientPayments,
    paymentsIncluded,
    viewerId: scope.viewerId,
    accessVersion: scope.accessVersion,
  };
}
