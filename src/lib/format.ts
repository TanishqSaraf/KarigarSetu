const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const grams = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** ₹1,23,456 (paise shown only when present). */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? inr0.format(rounded) : inr2.format(rounded);
}

/** "20.000" — always 3 decimals, Indian digit grouping. */
export function formatGramsValue(g: number): string {
  const v = Math.round(g * 1000) / 1000;
  return grams.format(Object.is(v, -0) ? 0 : v);
}

/** "20.000 g" */
export function formatGrams(g: number): string {
  return `${formatGramsValue(g)} g`;
}

/** "+0.100 g" / "−0.100 g" */
export function formatSignedGrams(g: number): string {
  const v = Math.round(g * 1000) / 1000;
  if (v === 0) return '0.000 g';
  return `${v > 0 ? '+' : '−'}${formatGramsValue(Math.abs(v))} g`;
}

export function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return p;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
