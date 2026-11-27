import { customerExportTable } from "./customerReportExport";
import {
  customerReportDate,
  type CustomerReportRow,
  type CustomerReportColumn,
} from "./customerReport";
import { customerCountryDisplay } from "./customerLocation";
import { formatAcademyDateTime } from "./academyLocale";
export type StudentDirectoryColumn =
  | "name"
  | "email"
  | "phone"
  | "location"
  | "package"
  | "spent"
  | "renewals"
  | "registered"
  | "lastSignIn";
export function studentDirectoryExportTable(
  rows: (CustomerReportRow & {
    lastSignedIn?: string | null;
    activePackages: string[];
    activePackagesAr: string[];
  })[],
  columns: StudentDirectoryColumn[],
  language: "ar" | "en",
  paymentsAllowed: boolean
) {
  const ar = language === "ar",
    selected = columns.filter(column => column !== "spent" || paymentsAllowed);
  const mappings: Partial<
    Record<StudentDirectoryColumn, CustomerReportColumn>
  > = {
    name: "name",
    email: "email",
    phone: "phone",
    spent: "paid",
    renewals: "renewals",
    registered: "registered",
  };
  const extras = {
    location: ar ? "الموقع" : "Location",
    package: ar ? "باقات مسجّلة كنشطة" : "Packages marked active",
    lastSignIn: ar ? "آخر دخول" : "Last sign in",
  };
  const headers = selected.flatMap(column =>
    mappings[column]
      ? customerExportTable([], [mappings[column]!], language, paymentsAllowed)
          .headers
      : [extras[column as keyof typeof extras]]
  );
  const body = rows.map(row =>
    selected.flatMap(column => {
      const mapped = mappings[column];
      if (mapped)
        return customerExportTable([row], [mapped], language, paymentsAllowed)
          .body[0];
      if (column === "package")
        return [
          (row.loginRestricted
            ? ar
              ? "تسجيل الدخول مقيّد؛ "
              : "Login restricted; "
            : "") + (ar ? row.activePackagesAr : row.activePackages).join("; "),
        ];
      if (column === "location") {
        const country = customerCountryDisplay(row.country, language);
        return [
          [
            row.city,
            country.label +
              (country.needsReview
                ? ar
                  ? " (قيمة سابقة تحتاج مراجعة)"
                  : " (historical value to review)"
                : ""),
          ]
            .filter(Boolean)
            .join(", "),
        ];
      }
      const date = customerReportDate(row.lastSignedIn);
      return [date ? formatAcademyDateTime(date, language) : ""];
    })
  );
  return { headers, body };
}
