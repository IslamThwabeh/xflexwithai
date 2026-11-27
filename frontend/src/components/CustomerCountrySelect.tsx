import {
  CUSTOMER_COUNTRY_CODES,
  customerCountryName,
} from "@shared/customerLocation";
import { useMemo } from "react";

export default function CustomerCountrySelect({
  value,
  onChange,
  language,
  id = "country",
  className,
  legacyValue,
  required = true,
}: {
  value: string;
  onChange: (value: string) => void;
  language: string;
  id?: string;
  className?: string;
  legacyValue?: string;
  required?: boolean;
}) {
  const ar = language === "ar";
  const codes = useMemo(
    () => [
      "PS",
      ...CUSTOMER_COUNTRY_CODES.filter(code => code !== "PS").sort((a, b) =>
        customerCountryName(a, language).localeCompare(
          customerCountryName(b, language),
          ar ? "ar" : "en"
        )
      ),
    ],
    [language]
  );
  return (
    <select
      id={id}
      name="country"
      autoComplete="country"
      value={value}
      onChange={event => onChange(event.target.value)}
      className={className}
      required={required}
    >
      <option value="" disabled>
        {ar ? "اختر بلد الإقامة" : "Choose country of residence"}
      </option>
      {legacyValue && (
        <option value="legacy" disabled>
          {legacyValue} —{" "}
          {ar ? "قيمة سابقة تحتاج مراجعة" : "historical value to review"}
        </option>
      )}
      {codes.map(code => (
        <option key={code} value={code}>
          {customerCountryName(code, language)}
        </option>
      ))}
    </select>
  );
}
