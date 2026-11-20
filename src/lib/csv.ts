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

type SaveOutcome = 'saved' | 'declined' | 'failed';

interface DownloadsNS {
  save(req: { filename: string; data: string | Blob }): Promise<unknown>;
}
type ClaudeHost = { use?: (name: 'downloads') => Promise<DownloadsNS | null> };

/**
 * Offer a text file to the user. Inside the Claude artifact viewer, page-initiated downloads are
 * blocked, so the viewer's `downloads` capability is used (the viewer confirms the save).
 * Everywhere else this falls back to a normal browser download.
 * CSV gets a UTF-8 BOM so Excel shows the rupee sign and names correctly.
 */
export async function downloadText(filename: string, text: string, mime: string): Promise<SaveOutcome> {
  const body = mime.includes('csv') ? '﻿' + text : text;
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const downloads = await host.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: body });
        return 'saved';
      } catch (e) {
        return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  browserDownload(filename, body, mime);
  return 'saved';
}

function browserDownload(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
