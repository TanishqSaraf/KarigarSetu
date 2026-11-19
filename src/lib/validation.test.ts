import { describe, expect, it } from 'vitest';
import { parseAmount, parsePhone, parseWeight } from './validation';
import { formatGrams, formatINR, formatSignedGrams } from './format';

describe('parseWeight', () => {
  it('accepts up to 3 decimals', () => {
    expect(parseWeight('19.500')).toEqual({ ok: true, value: 19.5 });
    expect(parseWeight('0.1')).toEqual({ ok: true, value: 0.1 });
    expect(parseWeight('.25')).toEqual({ ok: true, value: 0.25 });
  });
  it('rejects negatives, junk and >3 decimals', () => {
    expect(parseWeight('-1').ok).toBe(false);
    expect(parseWeight('abc').ok).toBe(false);
    expect(parseWeight('1.2345').ok).toBe(false);
    expect(parseWeight('1e3').ok).toBe(false);
    expect(parseWeight('').ok).toBe(false);
    expect(parseWeight('0', { allowZero: false }).ok).toBe(false);
  });
  it('treats empty as zero when optional', () => {
    expect(parseWeight('', { required: false })).toEqual({ ok: true, value: 0 });
  });
});

describe('parseAmount / parsePhone', () => {
  it('parses rupee amounts', () => {
    expect(parseAmount('1,23,456')).toEqual({ ok: true, value: 123456 });
    expect(parseAmount('₹ 500.50')).toEqual({ ok: true, value: 500.5 });
    expect(parseAmount('-5').ok).toBe(false);
    expect(parseAmount('5.555').ok).toBe(false);
  });
  it('parses Indian mobile numbers', () => {
    expect(parsePhone('+91 98260 41127')).toEqual({ ok: true, value: '9826041127' });
    expect(parsePhone('09826041127')).toEqual({ ok: true, value: '9826041127' });
    expect(parsePhone('12345').ok).toBe(false);
  });
});

describe('formatting', () => {
  it('uses Indian grouping for rupees', () => {
    expect(formatINR(215000)).toBe('₹2,15,000');
    expect(formatINR(36999.5)).toBe('₹36,999.50');
  });
  it('always shows grams with 3 decimals', () => {
    expect(formatGrams(20)).toBe('20.000 g');
    expect(formatGrams(1234.5)).toBe('1,234.500 g');
    expect(formatSignedGrams(-0.1)).toBe('−0.100 g');
  });
});
