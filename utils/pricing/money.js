/**
 * Money helpers — all amounts in South African rand (ZAR) with 2 decimal places.
 * Firestore stores rand (e.g. 15, 45.50), not cents. toCents/fromCents are optional helpers only.
 */

export function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to 2 decimal places (ZAR). */
export function roundMoney(amount) {
  return Math.round(parseMoney(amount) * 100) / 100;
}

export function toCents(amount) {
  return Math.round(roundMoney(amount) * 100);
}

export function fromCents(cents) {
  return roundMoney(Number(cents) / 100);
}
