import { txnEffect } from './calculations';
import { formatGramsValue } from './format';
import { TXN_TYPE_LABEL } from './orders';
import type { GoldTransaction, Karigar } from './types';

export function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export const LEDGER_CSV_HEADER = [
  'Date',
  'Transaction ID',
  'Karigar',
  'Order ID',
  'Transaction type',
  'Detail',
  'Purity',
  'Weight (g)',
  'Effect on karigar balance (g)',
  'Reconciliation',
  'Voided',
  'Notes',
];

/** Ledger rows for CSV. Weights are written as plain numbers with 3 decimals (no grouping) for spreadsheets. */
export function ledgerToCSV(
  txns: GoldTransaction[],
  karigars: Karigar[],
  reconLabel: (t: GoldTransaction) => string,
): string {
  const name = (id: string) => karigars.find((k) => k.id === id)?.name ?? id;
  const plain = (g: number) => formatGramsValue(g).replace(/,/g, '');
  const rows = txns.map((t) => [
    t.date,
    t.id,
    name(t.karigarId),
    t.orderId ?? '',
    TXN_TYPE_LABEL[t.type],
    adjustmentDetail(t),
    t.purity,
    plain(t.weight),
    t.voided ? '0.000' : plain(txnEffect(t)),
    reconLabel(t),
    t.voided ? `Yes — ${t.voided.reason}` : 'No',
    t.notes ?? '',
  ]);
  return toCSV([LEDGER_CSV_HEADER, ...rows]);
}

export function adjustmentDetail(t: GoldTransaction): string {
  if (t.type !== 'adjustment') return '';
  const dir = t.direction === 'increase' ? 'adds to balance' : 'reduces balance';
  if (t.reason === 'approved_loss') return `Approved process loss (${dir})`;
  if (t.reason === 'accepted_difference') return `Accepted difference (${dir})`;
  return `Manual adjustment (${dir})`;
}

/** Trigger a browser download. UTF-8 BOM so Excel shows ₹ and names correctly. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([mime.includes('csv') ? '﻿' + text : text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
