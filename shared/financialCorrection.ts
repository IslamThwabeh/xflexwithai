export type FinancialCorrectionRequest =
  | {
      action: "reverse";
      entryId: number;
      effectiveDate: string;
      reason: string;
      replacementAmountIlsMinor?: number | null;
      replacementDescription?: string | null;
    }
  | {
      action: "reclassify";
      entryId: number;
      nextPurpose: "new_sale" | "renewal" | "upgrade" | "copier_subscription";
      reason: string;
    };

export type FinancialControlEntry = {
  id: number;
  entryType: string;
  effectiveAt: string;
  baseAmountIlsMinor: number;
  description: string | null;
  sourceType: string;
  sourceReference: string;
  orderId: number | null;
  expenseId: number | null;
  refundId: number | null;
  transactionPurpose: string | null;
  reversed?: boolean;
};

export type FinancialCorrectionPreview = {
  original: FinancialControlEntry;
  request: FinancialCorrectionRequest;
  effectiveAt: string;
  reportingMonth: string;
  periodLocked: boolean;
  reversalAmountIlsMinor: number;
  replacementAmountIlsMinor: number | null;
  ledgerDeltaIlsMinor: number;
  previousPurpose: string | null;
  nextPurpose: string | null;
  generatedAt: string;
};
