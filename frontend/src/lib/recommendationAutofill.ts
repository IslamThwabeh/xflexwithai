export const recommendationFieldNames = [
  'symbol', 'side', 'entryPrice', 'stopLoss', 'takeProfit1', 'takeProfit2', 'takeProfit3', 'riskPercent',
] as const;
export type RecommendationFormFields = Record<typeof recommendationFieldNames[number], string>;

// Replace older values, including clearing missed fields. Edits made while the
// request was in flight take precedence.
export function applyRecommendationAutofill(
  current: RecommendationFormFields,
  atRequest: RecommendationFormFields,
  parsed: Partial<RecommendationFormFields>,
): RecommendationFormFields {
  return Object.fromEntries(recommendationFieldNames.map(field => [
    field, current[field] !== atRequest[field] ? current[field] : parsed[field] ?? '',
  ])) as RecommendationFormFields;
}

export function getMissingRecommendationFields(fields: Partial<RecommendationFormFields>) {
  return (['symbol', 'side', 'entryPrice', 'stopLoss', 'takeProfit1'] as const).filter(field => !fields[field]?.trim());
}
