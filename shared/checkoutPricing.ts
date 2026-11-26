/** VAT-inclusive native-currency pricing. All amounts are integer minor units.
 * The configured VAT on the payable amount remains authoritative. */
export function getCheckoutInvoiceAmounts(
  grossSubtotal: number,
  grossDiscount: number,
  vatRate = 16
) {
  if (
    ![grossSubtotal, grossDiscount, vatRate].every(Number.isSafeInteger) ||
    grossSubtotal < 0 ||
    grossDiscount < 0 ||
    grossDiscount > grossSubtotal ||
    vatRate < 0 ||
    vatRate > 100 ||
    !Number.isSafeInteger(grossSubtotal * vatRate)
  ) {
    throw new Error("Invalid checkout price, discount or VAT rate.");
  }
  const roundedRatio = (numerator: number, denominator: number) =>
    Math.floor(numerator / denominator) +
    (2 * (numerator % denominator) >= denominator ? 1 : 0);
  const totalAmount = grossSubtotal - grossDiscount;
  const vatAmount = roundedRatio(totalAmount * vatRate, 100 + vatRate);
  const originalVat = roundedRatio(grossSubtotal * vatRate, 100 + vatRate);
  const subtotal = grossSubtotal - originalVat;
  const discountAmount = subtotal - (totalAmount - vatAmount);
  return {
    subtotal,
    discountAmount,
    vatRate,
    vatAmount,
    totalAmount,
    grossSubtotalMinor: grossSubtotal,
    grossDiscountMinor: grossDiscount,
    formatVersion: 2 as const,
  };
}
