// Shared parser for broker `featuresEn` / `featuresAr` JSON arrays.
// Filters out items that duplicate the structured `minDeposit` field so the
// rendered chip list never re-exposes the legacy "min deposit" text.

const MIN_DEPOSIT_PATTERNS: RegExp[] = [
  // English: "min deposit", "min. deposit", "minimum deposit", "starting deposit", "initial deposit", "from $50", "starting at $50"
  /\bmin(?:imum)?\.?\s*deposit\b/i,
  /\b(?:starting|initial|first)\s+deposit\b/i,
  /\b(?:starting\s+at|from)\s*\$?\s*\d/i,
  // Arabic: "الحد الأدنى", "حد أدنى", "أقل إيداع", "أدنى إيداع", common spelling variants without alif madda
  /(?:^|\s)ال?حد\s*[اأ]?دنى/,
  /(?:^|\s)[اأ]قل\s+[اإ]?يداع/,
  /(?:^|\s)[اأ]دنى\s+[اإ]?يداع/,
];

export function isMinDepositFeature(item: string): boolean {
  const normalized = item.normalize('NFKC');
  return MIN_DEPOSIT_PATTERNS.some((re) => re.test(normalized));
}

export function parseBrokerFeatures(
  json: string | null | undefined,
  options?: { splitOnDash?: boolean },
): string[] {
  if (!json) return [];

  const splitOnDash = options?.splitOnDash ?? false;
  const normalize = (items: string[]): string[] => {
    const out = splitOnDash
      ? items.flatMap((item) => item.split(/\s*[-–—]+\s*/))
      : items;
    return out
      .map((item) => item.trim())
      .filter((item) => !!item && !isMinDepositFeature(item));
  };

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return normalize(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}
