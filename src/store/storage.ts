import { buildDemoData } from '../data/demo';
import type { AppData } from '../lib/types';

export const STORAGE_KEY = 'karigarsetu:data:v1';

/** Minimal structural check so a corrupted or foreign file is never loaded silently. */
export function isAppData(x: unknown): x is AppData {
  if (!x || typeof x !== 'object') return false;
  const d = x as Partial<AppData>;
  return (
    d.schemaVersion === 1 &&
    !!d.settings &&
    typeof d.settings.shopName === 'string' &&
    typeof d.settings.toleranceGrams === 'number' &&
    Array.isArray(d.karigars) &&
    Array.isArray(d.orders) &&
    Array.isArray(d.transactions) &&
    !!d.counters &&
    typeof d.counters.order === 'number' &&
    typeof d.counters.txn === 'number'
  );
}

export type LoadResult = { data: AppData; source: 'saved' | 'demo' | 'recovered' };

export function loadData(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isAppData(parsed)) return { data: parsed, source: 'saved' };
      return { data: buildDemoData(), source: 'recovered' };
    }
  } catch {
    return { data: buildDemoData(), source: 'recovered' };
  }
  return { data: buildDemoData(), source: 'demo' };
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid KarigarSetu backup (could not read JSON).');
  }
  if (!isAppData(parsed)) throw new Error('This file is not a KarigarSetu backup, or it is from an unsupported version.');
  return parsed;
}
