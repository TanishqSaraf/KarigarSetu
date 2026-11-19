import { describe, expect, it } from 'vitest';
import { buildDemoData, emptyData } from '../data/demo';
import { karigarBalance, orderGoldSummary, totalOutstanding } from '../lib/calculations';
import { attentionItems, filterOrders } from '../lib/orders';
import { ledgerToCSV } from '../lib/csv';
import { todayISO } from '../lib/dates';
import * as ops from './operations';
import type { OrderInput } from './operations';

const NOW = new Date('2026-11-19T10:00:00');
const TODAY = todayISO(NOW);

const input = (over: Partial<OrderInput> = {}): OrderInput => ({
  customerName: 'Test Customer',
  customerPhone: '9800000001',
  orderType: 'Custom',
  category: 'Ring',
  metalType: 'Yellow gold',
  purity: '22K',
  expectedWeight: 19.5,
  orderDate: TODAY,
  deliveryDate: '2026-11-30',
  advance: 1000,
  makingCharges: 2000,
  estimatedTotal: 50000,
  description: 'Plain band',
  ...over,
});

function setup() {
  let d = emptyData();
  const k = ops.addKarigar(d, { name: 'Ramesh', phone: '9826041127', specialisation: 'Rings' }, NOW);
  d = k.data;
  const o = ops.createOrder(d, input(), NOW);
  d = o.data;
  d = ops.assignKarigar(d, o.id, { karigarId: k.id, assignedDate: TODAY, expectedCompletionDate: '2026-11-28' }, NOW);
  return { d, karigarId: k.id, orderId: o.id };
}

describe('order workflow', () => {
  it('creates sequential order IDs with a "created" timeline event', () => {
    let d = emptyData();
    const a = ops.createOrder(d, input(), NOW);
    const b = ops.createOrder(a.data, input(), NOW);
    expect([a.id, b.id]).toEqual(['KS-1001', 'KS-1002']);
    d = b.data;
    expect(d.orders[0]!.timeline[0]!.type).toBe('created');
    expect(d.orders[0]!.status).toBe('new');
  });

  it('rejects invalid orders', () => {
    expect(() => ops.createOrder(emptyData(), input({ customerName: ' ' }))).toThrow(/customer name/);
    expect(() => ops.createOrder(emptyData(), input({ expectedWeight: -1 }))).toThrow(/negative/);
    expect(() => ops.createOrder(emptyData(), input({ deliveryDate: '2026-01-01' }))).toThrow(/before the order date/);
  });

  it('Tests 2–3: issue 20 g, receive 19.5 / 0.3 / 0.1 → 0.100 g unaccounted, within 0.100 g tolerance', () => {
    let { d, karigarId, orderId } = setup();
    expect(karigarBalance(karigarId, d.transactions)).toEqual({});
    d = ops.issueGold(d, orderId, { purity: '22K', weight: 20, date: TODAY }, NOW).data;
    expect(karigarBalance(karigarId, d.transactions)).toEqual({ '22K': 20 });
    expect(d.orders[0]!.status).toBe('gold_issued');

    d = ops.receiveItem(d, orderId, { gold: { purity: '22K', finished: 19.5, scrap: 0.3, approvedLoss: 0.1 }, date: TODAY }, NOW);
    const s = orderGoldSummary(d.orders[0]!, d.transactions, d.settings.toleranceGrams);
    expect(s.lines[0]!.unaccounted).toBe(0.1);
    expect(s.status).toBe('pending');
    expect(d.orders[0]!.status).toBe('received');
    expect(karigarBalance(karigarId, d.transactions)).toEqual({ '22K': 0.1 });
    // Three ledger entries for the return, never altered afterwards
    expect(d.transactions.map((t) => t.type)).toEqual(['issue', 'finished_return', 'scrap_return', 'adjustment']);
  });

  it('Test 4: difference beyond tolerance is flagged and needs a note to close', () => {
    let { d, orderId } = setup();
    d = ops.issueGold(d, orderId, { purity: '22K', weight: 20, date: TODAY }, NOW).data;
    d = ops.receiveItem(d, orderId, { gold: { purity: '22K', finished: 19, scrap: 0.3, approvedLoss: 0.1 }, date: TODAY }, NOW);
    const s = orderGoldSummary(d.orders[0]!, d.transactions, d.settings.toleranceGrams);
    expect(s.status).toBe('discrepancy');
    expect(s.worstUnaccounted).toBe(0.6);
    expect(attentionItems(d, TODAY).some((a) => a.kind === 'discrepancy' && a.orderId === orderId)).toBe(true);
    expect(() => ops.completeReconciliation(d, orderId, { resolution: 'kept_with_karigar', date: TODAY }, NOW)).toThrow(/note/);
    const closed = ops.completeReconciliation(d, orderId, { resolution: 'kept_with_karigar', note: 'Will return next visit', date: TODAY }, NOW);
    expect(orderGoldSummary(closed.orders[0]!, closed.transactions, 0.1).status).toBe('completed_with_difference');
  });

  it('accepting a difference records a visible adjustment entry (weights are never edited)', () => {
    let { d, karigarId, orderId } = setup();
    d = ops.issueGold(d, orderId, { purity: '22K', weight: 20, date: TODAY }, NOW).data;
    d = ops.receiveItem(d, orderId, { gold: { purity: '22K', finished: 19.5, scrap: 0.3, approvedLoss: 0.1 }, date: TODAY }, NOW);
    const before = d.transactions.map((t) => ({ ...t }));
    d = ops.completeReconciliation(d, orderId, { resolution: 'accepted_as_loss', date: TODAY }, NOW);
    expect(d.transactions.slice(0, before.length)).toEqual(before);
    const adj = d.transactions.at(-1)!;
    expect(adj).toMatchObject({ type: 'adjustment', reason: 'accepted_difference', direction: 'reduce', weight: 0.1 });
    expect(karigarBalance(karigarId, d.transactions)).toEqual({});
  });

  it('Test 5: multiple jobs for one karigar aggregate correctly', () => {
    let { d, karigarId, orderId } = setup();
    const second = ops.createOrder(d, input({ purity: '18K' }), NOW);
    d = ops.assignKarigar(second.data, second.id, { karigarId, assignedDate: TODAY, expectedCompletionDate: '2026-11-28' }, NOW);
    const third = ops.createOrder(d, input(), NOW);
    d = ops.assignKarigar(third.data, third.id, { karigarId, assignedDate: TODAY, expectedCompletionDate: '2026-11-28' }, NOW);
    d = ops.issueGold(d, orderId, { purity: '22K', weight: 20, date: TODAY }, NOW).data;
    d = ops.issueGold(d, second.id, { purity: '18K', weight: 6.25, date: TODAY }, NOW).data;
    d = ops.issueGold(d, third.id, { purity: '22K', weight: 8.125, date: TODAY }, NOW).data;
    expect(karigarBalance(karigarId, d.transactions)).toEqual({ '18K': 6.25, '22K': 28.125 });
    d = ops.receiveItem(d, third.id, { gold: { purity: '22K', finished: 8, scrap: 0.1, approvedLoss: 0.025 }, date: TODAY }, NOW);
    expect(karigarBalance(karigarId, d.transactions)).toEqual({ '18K': 6.25, '22K': 20 });
    expect(orderGoldSummary(d.orders.find((o) => o.id === third.id)!, d.transactions, 0.1).lines[0]!.unaccounted).toBe(0);
  });

  it('blocks reassigning while gold is with the previous karigar', () => {
    let { d, orderId } = setup();
    const k2 = ops.addKarigar(d, { name: 'Abdul', phone: '', specialisation: '' }, NOW);
    d = ops.issueGold(k2.data, orderId, { purity: '22K', weight: 5, date: TODAY }, NOW).data;
    expect(() => ops.assignKarigar(d, orderId, { karigarId: k2.id, assignedDate: TODAY, expectedCompletionDate: TODAY }, NOW)).toThrow(/still with/);
  });

  it('voiding an entry keeps it visible but removes it from balances', () => {
    let { d, karigarId, orderId } = setup();
    const r = ops.issueGold(d, orderId, { purity: '22K', weight: 5, date: TODAY }, NOW);
    d = ops.voidTransaction(r.data, r.id, 'typo', NOW);
    expect(d.transactions).toHaveLength(1);
    expect(d.transactions[0]!.voided?.reason).toBe('typo');
    expect(karigarBalance(karigarId, d.transactions)).toEqual({});
  });

  it('rejects negative or zero gold issue and over-precise weights', () => {
    const { d, orderId } = setup();
    expect(() => ops.issueGold(d, orderId, { purity: '22K', weight: 0, date: TODAY })).toThrow();
    expect(() => ops.issueGold(d, orderId, { purity: '22K', weight: -2, date: TODAY })).toThrow(/negative/);
    expect(() => ops.issueGold(d, orderId, { purity: '22K', weight: 1.2345, date: TODAY })).toThrow(/3 decimal/);
  });
});

describe('demo data', () => {
  const demo = buildDemoData(NOW);
  const tol = demo.settings.toleranceGrams;
  it('has the required shape', () => {
    expect(demo.karigars).toHaveLength(4);
    expect(demo.orders.length).toBeGreaterThanOrEqual(8);
    expect(new Set(demo.orders.map((o) => o.category)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(demo.orders.map((o) => o.purity))).toEqual(new Set(['22K', '18K']));
    expect(demo.orders.some((o) => o.status === 'ready')).toBe(true);
    expect(demo.orders.some((o) => o.status === 'delivered')).toBe(true);
    expect(demo.orders.some((o) => o.status === 'new')).toBe(true);
  });
  it('contains exactly one deliberate discrepancy (KS-1003, 0.700 g)', () => {
    const disc = demo.orders.filter((o) => orderGoldSummary(o, demo.transactions, tol).status === 'discrepancy');
    expect(disc.map((o) => o.id)).toEqual(['KS-1003']);
    expect(orderGoldSummary(disc[0]!, demo.transactions, tol).worstUnaccounted).toBe(0.7);
  });
  it('has overdue, stale and ready alerts', () => {
    const kinds = new Set(attentionItems(demo, TODAY).map((a) => a.kind));
    expect(kinds).toEqual(new Set(['discrepancy', 'overdue', 'ready_not_delivered', 'stale', 'reconcile']));
  });
  it('outstanding gold is consistent and kept by purity', () => {
    expect(totalOutstanding(demo.transactions)).toEqual({ '18K': 21.7, '22K': 1.25 });
  });
  it('filters orders by status, karigar and due date', () => {
    const ramesh = demo.karigars.find((k) => k.name === 'Ramesh Soni')!.id;
    const base = { q: '', status: 'all' as const, karigar: 'all', due: 'all' as const };
    expect(filterOrders(demo, { ...base, due: 'overdue' }, TODAY).map((o) => o.id)).toEqual(['KS-1005']);
    expect(filterOrders(demo, { ...base, karigar: ramesh }, TODAY).map((o) => o.id).sort()).toEqual(['KS-1002', 'KS-1005', 'KS-1006']);
    expect(filterOrders(demo, { ...base, karigar: 'none' }, TODAY).map((o) => o.id)).toEqual(['KS-1010']);
    expect(filterOrders(demo, { ...base, status: 'ready' }, TODAY).map((o) => o.id)).toEqual(['KS-1004']);
    expect(filterOrders(demo, { ...base, q: 'meena' }, TODAY).map((o) => o.id)).toEqual(['KS-1003']);
    expect(filterOrders(demo, { ...base, q: '94251' }, TODAY).map((o) => o.id)).toEqual(['KS-1003']);
  });
  it('CSV export contains every ledger entry with escaped notes', () => {
    const csv = ledgerToCSV(demo.transactions, demo.karigars, () => '');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(demo.transactions.length + 1);
    expect(lines[0]).toContain('Transaction ID');
    expect(csv).toContain('"Yes — Typing mistake — actual weight was 16.500 g, re-entered"');
  });
});
