const USD_TO_ILS_RATE = 3.5;

function getLocale(language: string) {
  return language === 'ar' ? 'ar-EG' : 'en-US';
}

function normalizeAmount(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function isShekelCurrency(currency?: string | null) {
  const normalized = currency?.trim().toUpperCase();
  return normalized === 'ILS' || normalized === 'NIS';
}

function toShekelAmount(amount: number, sourceCurrency?: string | null) {
  const normalizedAmount = normalizeAmount(amount);
  if (isShekelCurrency(sourceCurrency)) {
    return normalizedAmount;
  }

  return normalizedAmount * USD_TO_ILS_RATE;
}

export function usdToIls(amountUsd: number) {
  return toShekelAmount(amountUsd, 'USD');
}

export function usdCentsToIls(amountUsdCents: number) {
  return usdToIls(normalizeAmount(amountUsdCents) / 100);
}

export function ilsToUsd(amountIls: number) {
  return normalizeAmount(amountIls) / USD_TO_ILS_RATE;
}

export function ilsToUsdCents(amountIls: number) {
  return Math.round(ilsToUsd(amountIls) * 100);
}

export function formatAdminNumberInput(value: number) {
  const normalized = normalizeAmount(value);
  return normalized.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function formatAdminCurrency(
  amount: number,
  language: string,
  options?: {
    sourceCurrency?: string | null;
    fromCents?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  const sourceAmount = options?.fromCents ? normalizeAmount(amount) / 100 : normalizeAmount(amount);
  const shekelAmount = toShekelAmount(sourceAmount, options?.sourceCurrency ?? 'USD');

  return new Intl.NumberFormat(getLocale(language), {
    style: 'currency',
    currency: 'ILS',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(shekelAmount);
}

export function formatAdminCurrencyFromUsd(
  amountUsd: number,
  language: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  return formatAdminCurrency(amountUsd, language, {
    sourceCurrency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits,
  });
}

export function formatAdminCurrencyFromUsdCents(
  amountUsdCents: number,
  language: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  return formatAdminCurrency(amountUsdCents, language, {
    sourceCurrency: 'USD',
    fromCents: true,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits,
  });
}

export function formatSourceCurrencyAmount(
  amount: number,
  language: string,
  options?: {
    currency?: string | null;
    fromCents?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  const sourceAmount = options?.fromCents ? normalizeAmount(amount) / 100 : normalizeAmount(amount);
  const rawCurrency = options?.currency?.trim().toUpperCase() || 'USD';
  // Intl.NumberFormat requires a valid ISO 4217 code. Anything else throws RangeError
  // and would crash the entire broker list render. Fall back to a plain decimal.
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';

  try {
    return new Intl.NumberFormat(getLocale(language), {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(sourceAmount);
  } catch {
    const formatted = new Intl.NumberFormat(getLocale(language), {
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(sourceAmount);
    return `${formatted} ${rawCurrency}`;
  }
}