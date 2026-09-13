import type { FinancialTransactionPurpose } from '../../shared/financialTransactionPurpose';

const DAY_MS = 86_400_000;

export type RenewalPackageShape = {
  slug?: string | null;
  packageType?: string | null;
  renewalPeriodDays?: number | null;
  durationDays?: number | null;
  includesLexai?: boolean | null;
  includesRecommendations?: boolean | null;
};

export function getCanonicalRenewalTerms(pkg: RenewalPackageShape) {
  if (pkg.packageType === 'live' || pkg.slug === 'live-package') {
    throw new Error('Live Package does not support renewal.');
  }
  const amountIlsMinor = pkg.slug === 'basic'
    ? 17_500
    : pkg.slug === 'comprehensive'
      ? 35_000
      : 0;
  if (!amountIlsMinor) throw new Error('This package does not have approved renewal pricing.');
  const entitlementDays = Number(pkg.renewalPeriodDays || pkg.durationDays || 0);
  if (!Number.isInteger(entitlementDays) || entitlementDays < 1 || entitlementDays > 3650) {
    throw new Error('This package does not have an approved renewal duration.');
  }
  return { amountIlsMinor, entitlementDays, currency: 'ILS' as const, transactionPurpose: 'renewal' as FinancialTransactionPurpose };
}

export function projectRenewalEnd(currentEndAt: string | null | undefined, entitlementDays: number, now = new Date()) {
  const parsed = currentEndAt ? new Date(currentEndAt) : null;
  const base = parsed && !Number.isNaN(parsed.getTime()) && parsed > now ? parsed : now;
  return new Date(base.getTime() + entitlementDays * DAY_MS).toISOString();
}

export function buildRenewalProjection(input: {
  pkg: RenewalPackageShape;
  recommendationsCurrentEndAt?: string | null;
  lexaiCurrentEndAt?: string | null;
  now?: Date;
}) {
  const terms = getCanonicalRenewalTerms(input.pkg);
  const now = input.now ?? new Date();
  return {
    ...terms,
    recommendationsCurrentEndAt: input.pkg.includesRecommendations ? input.recommendationsCurrentEndAt ?? null : null,
    lexaiCurrentEndAt: input.pkg.includesLexai ? input.lexaiCurrentEndAt ?? null : null,
    recommendationsProjectedEndAt: input.pkg.includesRecommendations
      ? projectRenewalEnd(input.recommendationsCurrentEndAt, terms.entitlementDays, now)
      : null,
    lexaiProjectedEndAt: input.pkg.includesLexai
      ? projectRenewalEnd(input.lexaiCurrentEndAt, terms.entitlementDays, now)
      : null,
  };
}
