// Gold accountability & payment calculations.
// Pure functions only — no React, no storage. Covered by calculations.test.ts.
//
// To avoid floating-point drift (0.1 + 0.2 ≠ 0.3), every weight is converted to whole
// milligrams before adding or subtracting, and converted back to grams at the end.

import type { GoldTransaction, Order, Purity } from './types';

export const toMg = (grams: number): number => Math.round(grams * 1000);
export const fromMg = (mg: number): number => mg / 1000;

/** Purity labels are compared case-insensitively and without spaces: "22k" === "22K". */
export function normalisePurity(p: string): Purity {
  return p.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * The core reconciliation formula.
 * Unaccounted Weight = Gold Issued − Finished Metal Weight − Scrap Returned − Approved Process Loss
 * Positive result: gold still unexplained (with the karigar). Negative: more came back than was issued.
 */
export function computeUnaccounted(input: {
  issued: number;
  finished: number;
  scrap: number;
  approvedLoss: number;
  /** Optional net of other manual adjustments; positive increases what the karigar owes. */
  otherAdjustments?: number;
}): number {
  const mg =
    toMg(input.issued) -
    toMg(input.finished) -
    toMg(input.scrap) -
    toMg(input.approvedLoss) +
    toMg(input.otherAdjustments ?? 0);
  return fromMg(mg);
}

/** True only when the absolute difference is strictly greater than the owner's tolerance. */
export function exceedsTolerance(unaccounted: number, toleranceGrams: number): boolean {
  return Math.abs(toMg(unaccounted)) > toMg(Math.max(0, toleranceGrams));
}

export const isActiveTxn = (t: GoldTransaction): boolean => !t.voided;

/**
 * Signed effect of a ledger entry on what the karigar holds, in milligrams.
 * Issue adds to the karigar's balance; returns and "reduce" adjustments take it away.
 * Voided entries have no effect.
 */
export function txnEffectMg(t: GoldTransaction): number {
  if (t.voided) return 0;
  const mg = toMg(t.weight);
  switch (t.type) {
    case 'issue':
      return mg;
    case 'finished_return':
    case 'scrap_return':
      return -mg;
    case 'adjustment':
      return t.direction === 'increase' ? mg : -mg;
  }
}

export const txnEffect = (t: GoldTransaction): number => fromMg(txnEffectMg(t));

export interface PurityReconciliation {
  purity: Purity;
  issued: number;
  finished: number;
  scrap: number;
  approvedLoss: number;
  /** Other adjustments, net. Positive = karigar owes more. */
  otherAdjustments: number;
  unaccounted: number;
  hasReturn: boolean;
  exceedsTolerance: boolean;
}

/** Reconcile the gold for one order, separately for each purity involved. */
export function reconcileTransactions(txns: GoldTransaction[], toleranceGrams: number): PurityReconciliation[] {
  const byPurity = new Map<Purity, { issued: number; finished: number; scrap: number; loss: number; other: number; returns: number }>();
  for (const t of txns) {
    if (t.voided) continue;
    const key = normalisePurity(t.purity);
    const row = byPurity.get(key) ?? { issued: 0, finished: 0, scrap: 0, loss: 0, other: 0, returns: 0 };
    const mg = toMg(t.weight);
    if (t.type === 'issue') row.issued += mg;
    else if (t.type === 'finished_return') {
      row.finished += mg;
      row.returns++;
    } else if (t.type === 'scrap_return') {
      row.scrap += mg;
      row.returns++;
    } else if (t.type === 'adjustment') {
      if (t.reason === 'approved_loss' && t.direction !== 'increase') row.loss += mg;
      else row.other += t.direction === 'increase' ? mg : -mg;
    }
    byPurity.set(key, row);
  }
  return [...byPurity.entries()]
    .map(([purity, r]) => {
      const unaccounted = fromMg(r.issued - r.finished - r.scrap - r.loss + r.other);
      return {
        purity,
        issued: fromMg(r.issued),
        finished: fromMg(r.finished),
        scrap: fromMg(r.scrap),
        approvedLoss: fromMg(r.loss),
        otherAdjustments: fromMg(r.other),
        unaccounted,
        hasReturn: r.returns > 0,
        exceedsTolerance: exceedsTolerance(unaccounted, toleranceGrams),
      };
    })
    .sort((a, b) => a.purity.localeCompare(b.purity));
}

export type ReconStatus =
  | 'no_gold' // nothing issued for this order
  | 'awaiting_return' // gold issued, nothing received back yet
  | 'pending' // received back, within tolerance, owner hasn't closed it
  | 'discrepancy' // received back, difference beyond tolerance, not closed
  | 'completed' // owner closed reconciliation, nothing left unexplained
  | 'completed_with_difference'; // owner closed it while noting a difference

export interface OrderGoldSummary {
  lines: PurityReconciliation[];
  status: ReconStatus;
  /** Largest absolute unaccounted weight across purities (for headline display). */
  worstUnaccounted: number;
}

export function orderGoldSummary(order: Order, allTxns: GoldTransaction[], toleranceGrams: number): OrderGoldSummary {
  const lines = reconcileTransactions(
    allTxns.filter((t) => t.orderId === order.id),
    toleranceGrams,
  );
  const worstUnaccounted = lines.reduce((w, l) => (Math.abs(l.unaccounted) > Math.abs(w) ? l.unaccounted : w), 0);
  const issuedAny = lines.some((l) => l.issued > 0);
  const returnedAny = lines.some((l) => l.hasReturn);

  let status: ReconStatus;
  if (order.reconciliation) {
    status = lines.some((l) => toMg(l.unaccounted) !== 0) ? 'completed_with_difference' : 'completed';
  } else if (!issuedAny) status = 'no_gold';
  else if (!returnedAny) status = 'awaiting_return';
  else if (lines.some((l) => l.exceedsTolerance)) status = 'discrepancy';
  else status = 'pending';

  return { lines, status, worstUnaccounted };
}

/** Balance per purity, in grams, for a set of ledger entries. Zero balances are omitted. */
export function balancesByPurity(txns: GoldTransaction[]): Record<Purity, number> {
  const mg: Record<Purity, number> = {};
  for (const t of txns) {
    if (t.voided) continue;
    const key = normalisePurity(t.purity);
    mg[key] = (mg[key] ?? 0) + txnEffectMg(t);
  }
  const out: Record<Purity, number> = {};
  for (const [k, v] of Object.entries(mg).sort(([a], [b]) => a.localeCompare(b))) {
    if (v !== 0) out[k] = fromMg(v);
  }
  return out;
}

/** What one karigar currently holds, per purity. */
export function karigarBalance(karigarId: string, txns: GoldTransaction[]): Record<Purity, number> {
  return balancesByPurity(txns.filter((t) => t.karigarId === karigarId));
}

/** Map of karigarId → per-purity balance. */
export function allKarigarBalances(txns: GoldTransaction[]): Map<string, Record<Purity, number>> {
  const grouped = new Map<string, GoldTransaction[]>();
  for (const t of txns) {
    const list = grouped.get(t.karigarId) ?? [];
    list.push(t);
    grouped.set(t.karigarId, list);
  }
  const out = new Map<string, Record<Purity, number>>();
  for (const [id, list] of grouped) out.set(id, balancesByPurity(list));
  return out;
}

/** Total gold with all karigars, per purity. */
export function totalOutstanding(txns: GoldTransaction[]): Record<Purity, number> {
  return balancesByPurity(txns);
}

export function compareTxns(a: GoldTransaction, b: GoldTransaction): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Oldest-first list with the running balance (for that entry's purity) after each entry. */
export function withRunningBalance(txns: GoldTransaction[]): Array<{ txn: GoldTransaction; balanceAfter: number }> {
  const running: Record<Purity, number> = {};
  return [...txns].sort(compareTxns).map((txn) => {
    const key = normalisePurity(txn.purity);
    running[key] = (running[key] ?? 0) + txnEffectMg(txn);
    return { txn, balanceAfter: fromMg(running[key]!) };
  });
}

/** Total gold issued on an order (all purities, each kept separate). */
export function issuedByPurity(orderId: string, txns: GoldTransaction[]): Record<Purity, number> {
  const mg: Record<Purity, number> = {};
  for (const t of txns) {
    if (t.voided || t.orderId !== orderId || t.type !== 'issue') continue;
    const key = normalisePurity(t.purity);
    mg[key] = (mg[key] ?? 0) + toMg(t.weight);
  }
  return Object.fromEntries(Object.entries(mg).map(([k, v]) => [k, fromMg(v)]));
}

export interface PaymentSummary {
  estimatedTotal: number;
  advance: number;
  laterPayments: number;
  received: number;
  remaining: number;
}

/** Money only — kept entirely separate from gold weights. Amounts are rounded to paise. */
export function paymentSummary(order: Pick<Order, 'estimatedTotal' | 'advance' | 'payments'>): PaymentSummary {
  const p = (n: number) => Math.round(n * 100);
  const later = order.payments.reduce((s, x) => s + p(x.amount), 0);
  const received = p(order.advance) + later;
  return {
    estimatedTotal: order.estimatedTotal,
    advance: order.advance,
    laterPayments: later / 100,
    received: received / 100,
    remaining: (p(order.estimatedTotal) - received) / 100,
  };
}
