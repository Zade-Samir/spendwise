/**
 * Financial utility functions strictly operating on integer paise (minor units).
 * Inviolable Rule 1: Never use raw floating-point calculations for currency.
 */

const MAX_PAISE = 1_000_000_000; // ₹10,00,000.00 (10 crore)

/**
 * Parses a rupee string (e.g. "150", "150.5", "150.50", "1,500.00") into integer paise.
 * Returns 0 if input is empty or invalid. Caps at MAX_PAISE.
 */
export function parseRupeesToMinor(val: string): number {
  if (!val) return 0;

  // Remove commas, spaces, currency symbols
  const cleaned = val.replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return 0;

  // Validate number format (optional integer and up to 2 decimal places)
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    // If user enters invalid characters, try parsing leading valid float
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.min(Math.round(num * 100), MAX_PAISE);
  }

  const parts = cleaned.split('.');
  const wholeStr = parts[0] || '0';
  const fracStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);

  const whole = parseInt(wholeStr, 10);
  const frac = parseInt(fracStr, 10);

  if (isNaN(whole) || isNaN(frac)) return 0;

  const totalPaise = whole * 100 + frac;
  return Math.min(totalPaise, MAX_PAISE);
}

/**
 * Formats integer paise into Indian Rupee string (e.g. ₹1,50,000.00 or ₹1,50,000).
 */
export function formatINR(
  amountMinor: number,
  options?: { showPaise?: boolean; sign?: boolean }
): string {
  const isNegative = amountMinor < 0;
  const absMinor = Math.abs(Math.round(amountMinor));
  const rupees = absMinor / 100;

  const hasPaise = absMinor % 100 !== 0;
  const showPaise = options?.showPaise ?? hasPaise;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(rupees);

  if (options?.sign && isNegative) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Formats integer paise into compact Indian numbering format (e.g. ₹1.5L, ₹25K, ₹1.2Cr).
 */
export function formatINRCompact(amountMinor: number): string {
  const isNegative = amountMinor < 0;
  const absMinor = Math.abs(Math.round(amountMinor));
  const rupees = absMinor / 100;

  let formatted: string;
  if (rupees >= 10_000_000) {
    // 1 Crore = 10,000,000
    const cr = rupees / 10_000_000;
    formatted = `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (rupees >= 100_000) {
    // 1 Lakh = 100,000
    const lk = rupees / 100_000;
    formatted = `₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(2).replace(/\.?0+$/, '')} L`;
  } else if (rupees >= 10_000) {
    // Thousands
    const k = rupees / 1_000;
    formatted = `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.?0+$/, '')} K`;
  } else {
    formatted = formatINR(absMinor, { showPaise: false });
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats raw payment method enum values into human-readable labels.
 */
export function formatPaymentMethod(method?: string | null): string {
  if (!method) return 'Other';
  switch (method.toLowerCase()) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'cash':
      return 'Cash';
    case 'bank':
    case 'bank_transfer':
    case 'netbanking':
      return 'Net Banking';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}
