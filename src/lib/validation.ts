// Input parsing & validation for weights, amounts and phone numbers.
// Returns either a value or a plain-English error message.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_WEIGHT_GRAMS = 5000;
export const MAX_AMOUNT = 10_00_00_000; // ₹10 crore — a sanity ceiling, not a business rule.

/** Weight in grams: non-negative, max 3 decimals. Empty input is an error unless allowEmpty. */
export function parseWeight(raw: string, opts: { required?: boolean; allowZero?: boolean } = {}): Parsed<number> {
  const { required = true, allowZero = true } = opts;
  const s = raw.trim().replace(/,/g, '');
  if (s === '') {
    return required ? { ok: false, error: 'Enter a weight in grams' } : { ok: true, value: 0 };
  }
  if (s.startsWith('-')) return { ok: false, error: 'Weight cannot be negative' };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { ok: false, error: 'Enter a number, e.g. 12.345' };
  const decimals = s.includes('.') ? s.split('.')[1]!.length : 0;
  if (decimals > 3) return { ok: false, error: 'Use at most 3 decimal places (milligrams)' };
  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a valid number' };
  if (!allowZero && value === 0) return { ok: false, error: 'Weight must be more than 0 g' };
  if (value > MAX_WEIGHT_GRAMS) return { ok: false, error: `That is more than ${MAX_WEIGHT_GRAMS} g — please check` };
  return { ok: true, value: Math.round(value * 1000) / 1000 };
}

/** Rupee amount: non-negative, max 2 decimals. Empty = 0 unless required. */
export function parseAmount(raw: string, opts: { required?: boolean } = {}): Parsed<number> {
  const s = raw.trim().replace(/,/g, '').replace(/^₹\s*/, '');
  if (s === '') return opts.required ? { ok: false, error: 'Enter an amount' } : { ok: true, value: 0 };
  if (s.startsWith('-')) return { ok: false, error: 'Amount cannot be negative' };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { ok: false, error: 'Enter a number, e.g. 2500' };
  const decimals = s.includes('.') ? s.split('.')[1]!.length : 0;
  if (decimals > 2) return { ok: false, error: 'Use at most 2 decimal places (paise)' };
  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a valid amount' };
  if (value > MAX_AMOUNT) return { ok: false, error: 'That amount looks too large — please check' };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** Indian mobile number: 10 digits, optionally prefixed with +91 / 0. */
export function parsePhone(raw: string, opts: { required?: boolean } = {}): Parsed<string> {
  const s = raw.trim();
  if (s === '') return opts.required ? { ok: false, error: 'Enter a phone number' } : { ok: true, value: '' };
  let digits = s.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits)) return { ok: false, error: 'Enter a 10-digit mobile number' };
  return { ok: true, value: digits };
}

export function requireText(raw: string, label: string): Parsed<string> {
  const s = raw.trim();
  if (!s) return { ok: false, error: `Enter ${label}` };
  return { ok: true, value: s };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
