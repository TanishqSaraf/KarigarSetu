import { describe, expect, it } from 'vitest';
import {
  balancesByPurity,
  computeUnaccounted,
  exceedsTolerance,
  karigarBalance,
  paymentSummary,
  reconcileTransactions,
  totalOutstanding,
  withRunningBalance,
} from './calculations';
import type { GoldTransaction } from './types';

let seq = 0;
const txn = (p: Partial<GoldTransaction>): GoldTransaction => ({
  id: `T${++seq}`,
  date: '2026-11-01',
  karigarId: 'K-1',
  orderId: 'KS-1',
  type: 'issue',
  purity: '22K',
  weight: 0,
  createdAt: `2026-11-01T10:00:${String(seq).padStart(2, '0')}.000Z`,
  ...p,
});

describe('computeUnaccounted (Issued − Finished − Scrap − Approved loss)', () => {
  it('spec Test 3: 20.000 − 19.500 − 0.300 − 0.100 = 0.100 g exactly', () => {
    expect(computeUnaccounted({ issued: 20, finished: 19.5, scrap: 0.3, approvedLoss: 0.1 })).toBe(0.1);
  });
  it('avoids floating-point drift', () => {
    // In plain JS, 0.3 - 0.1 - 0.1 - 0.1 = 2.7755575615628914e-17
    expect(computeUnaccounted({ issued: 0.3, finished: 0.1, scrap: 0.1, approvedLoss: 0.1 })).toBe(0);
    expect(computeUnaccounted({ issued: 13, finished: 12.15, scrap: 0.65, approvedLoss: 0.18 })).toBe(0.02);
  });
  it('is negative when more comes back than was issued', () => {
    expect(computeUnaccounted({ issued: 10, finished: 9.9, scrap: 0.2, approvedLoss: 0 })).toBe(-0.1);
  });
});

describe('exceedsTolerance', () => {
  it('flags only differences strictly greater than the tolerance', () => {
    expect(exceedsTolerance(0.1, 0.1)).toBe(false);
    expect(exceedsTolerance(0.101, 0.1)).toBe(true);
    expect(exceedsTolerance(-0.101, 0.1)).toBe(true);
    expect(exceedsTolerance(0.7, 0.1)).toBe(true);
    expect(exceedsTolerance(0, 0)).toBe(false);
    expect(exceedsTolerance(0.001, 0)).toBe(true);
  });
});

describe('reconcileTransactions', () => {
  it('reconciles one order from ledger entries', () => {
    const lines = reconcileTransactions(
      [
        txn({ type: 'issue', weight: 20 }),
        txn({ type: 'finished_return', weight: 19.5 }),
        txn({ type: 'scrap_return', weight: 0.3 }),
        txn({ type: 'adjustment', reason: 'approved_loss', direction: 'reduce', weight: 0.1 }),
      ],
      0.1,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ purity: '22K', issued: 20, finished: 19.5, scrap: 0.3, approvedLoss: 0.1, unaccounted: 0.1, hasReturn: true, exceedsTolerance: false });
  });
  it('flags a return beyond tolerance (spec Test 4)', () => {
    const [line] = reconcileTransactions(
      [txn({ type: 'issue', weight: 20 }), txn({ type: 'finished_return', weight: 19 }), txn({ type: 'scrap_return', weight: 0.3 })],
      0.1,
    );
    expect(line!.unaccounted).toBe(0.7);
    expect(line!.exceedsTolerance).toBe(true);
  });
  it('keeps purities separate and ignores voided entries', () => {
    const lines = reconcileTransactions(
      [
        txn({ type: 'issue', weight: 10, purity: '22K' }),
        txn({ type: 'issue', weight: 5, purity: '18k' }),
        txn({ type: 'issue', weight: 99, purity: '18K', voided: { at: 'x', reason: 'typo' } }),
      ],
      0.1,
    );
    expect(lines.map((l) => [l.purity, l.issued])).toEqual([
      ['18K', 5],
      ['22K', 10],
    ]);
  });
});

describe('balances', () => {
  const txns = [
    // Karigar K-1, two jobs (spec Test 5)
    txn({ karigarId: 'K-1', orderId: 'A', type: 'issue', weight: 20, purity: '22K' }),
    txn({ karigarId: 'K-1', orderId: 'B', type: 'issue', weight: 7.25, purity: '22K' }),
    txn({ karigarId: 'K-1', orderId: 'C', type: 'issue', weight: 5, purity: '18K' }),
    txn({ karigarId: 'K-1', orderId: 'A', type: 'finished_return', weight: 19.5, purity: '22K' }),
    txn({ karigarId: 'K-1', orderId: 'A', type: 'scrap_return', weight: 0.3, purity: '22K' }),
    txn({ karigarId: 'K-1', orderId: 'A', type: 'adjustment', reason: 'approved_loss', direction: 'reduce', weight: 0.1, purity: '22K' }),
    // Karigar K-2
    txn({ karigarId: 'K-2', orderId: 'D', type: 'issue', weight: 3, purity: '22K' }),
    txn({ karigarId: 'K-2', orderId: 'D', type: 'adjustment', reason: 'manual', direction: 'increase', weight: 0.05, purity: '22K' }),
  ];
  it('karigar balance aggregates all jobs, per purity', () => {
    expect(karigarBalance('K-1', txns)).toEqual({ '18K': 5, '22K': 7.35 });
    expect(karigarBalance('K-2', txns)).toEqual({ '22K': 3.05 });
    expect(karigarBalance('K-3', txns)).toEqual({});
  });
  it('total outstanding never mixes purities', () => {
    expect(totalOutstanding(txns)).toEqual({ '18K': 5, '22K': 10.4 });
  });
  it('omits zero balances', () => {
    expect(balancesByPurity([txn({ type: 'issue', weight: 1 }), txn({ type: 'finished_return', weight: 1 })])).toEqual({});
  });
  it('running balance follows date order', () => {
    const rows = withRunningBalance([
      txn({ date: '2026-11-03', type: 'finished_return', weight: 4 }),
      txn({ date: '2026-11-01', type: 'issue', weight: 5 }),
    ]);
    expect(rows.map((r) => r.balanceAfter)).toEqual([5, 1]);
  });
});

describe('paymentSummary', () => {
  it('computes remaining amount in rupees, separate from gold', () => {
    expect(
      paymentSummary({ estimatedTotal: 52000, advance: 5000, payments: [{ id: 'p', date: '2026-11-01', amount: 10000.5 }] }),
    ).toEqual({ estimatedTotal: 52000, advance: 5000, laterPayments: 10000.5, received: 15000.5, remaining: 36999.5 });
  });
});
