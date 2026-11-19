// Every change to the shop's data goes through one of these pure functions.
// Each takes the current AppData and returns a new AppData (never mutates), or throws a
// ValidationError with a plain-English message that the UI shows to the owner.
//
// Gold ledger entries are append-only: they are never edited or deleted. Mistakes are
// corrected by voiding an entry (with a reason, still visible) or adding an adjustment.

import { normalisePurity, orderGoldSummary, toMg } from '../lib/calculations';
import { formatDate, isValidISODate } from '../lib/dates';
import { formatGrams, formatINR } from '../lib/format';
import { STATUS_LABEL } from '../lib/orders';
import { ValidationError } from '../lib/validation';
import type {
  AdjustmentDirection,
  AppData,
  GoldTransaction,
  Karigar,
  Order,
  OrderStatus,
  Purity,
  Settings,
  TimelineEvent,
  TimelineEventType,
} from '../lib/types';

export type OrderInput = Pick<
  Order,
  | 'customerName'
  | 'customerPhone'
  | 'orderType'
  | 'category'
  | 'categoryOther'
  | 'metalType'
  | 'purity'
  | 'expectedWeight'
  | 'orderDate'
  | 'deliveryDate'
  | 'advance'
  | 'makingCharges'
  | 'estimatedTotal'
  | 'description'
  | 'designImage'
>;

export type KarigarInput = Pick<Karigar, 'name' | 'phone' | 'specialisation' | 'notes'>;

type Result<T = string> = { data: AppData; id: T };

// ---------- helpers ----------

function fail(message: string): never {
  throw new ValidationError(message);
}

function nextCounter(data: AppData, key: keyof AppData['counters']): [AppData, number] {
  const n = data.counters[key] + 1;
  return [{ ...data, counters: { ...data.counters, [key]: n } }, n];
}

function eventId(data: AppData): [AppData, string] {
  const [d, n] = nextCounter(data, 'misc');
  return [d, `EV-${n}`];
}

function getOrder(data: AppData, orderId: string): Order {
  return data.orders.find((o) => o.id === orderId) ?? fail(`Order ${orderId} was not found`);
}

function getKarigar(data: AppData, karigarId: string): Karigar {
  return data.karigars.find((k) => k.id === karigarId) ?? fail('That karigar was not found');
}

function replaceOrder(data: AppData, order: Order): AppData {
  return { ...data, orders: data.orders.map((o) => (o.id === order.id ? order : o)) };
}

function withEvent(
  data: AppData,
  order: Order,
  type: TimelineEventType,
  summary: string,
  at: string,
  note?: string,
): [AppData, Order] {
  const [d, id] = eventId(data);
  const event: TimelineEvent = { id, type, at, summary, ...(note?.trim() ? { note: note.trim() } : {}) };
  return [d, { ...order, timeline: [...order.timeline, event], updatedAt: at }];
}

function addTxns(data: AppData, partials: Array<Omit<GoldTransaction, 'id' | 'createdAt'>>, at: string): [AppData, string[]] {
  let d = data;
  const ids: string[] = [];
  const created: GoldTransaction[] = [];
  for (const p of partials) {
    const [d2, n] = nextCounter(d, 'txn');
    d = d2;
    const id = `GT-${String(n).padStart(4, '0')}`;
    ids.push(id);
    created.push({ ...p, id, purity: normalisePurity(p.purity), createdAt: at });
  }
  return [{ ...d, transactions: [...d.transactions, ...created] }, ids];
}

function assertDate(s: string, label: string) {
  if (!isValidISODate(s)) fail(`Enter a valid ${label}`);
}

function assertWeight(n: number, label: string, { positive = false } = {}) {
  if (!Number.isFinite(n) || n < 0) fail(`${label} cannot be negative`);
  if (positive && n <= 0) fail(`${label} must be more than 0 g`);
  if (Math.abs(toMg(n) - n * 1000) > 1e-6) fail(`${label}: use at most 3 decimal places`);
}

function assertAmount(n: number, label: string) {
  if (!Number.isFinite(n) || n < 0) fail(`${label} cannot be negative`);
}

/** Opening a closed reconciliation again whenever new gold entries arrive for the order. */
function reopenIfClosed(data: AppData, order: Order, at: string, why: string): [AppData, Order] {
  if (!order.reconciliation) return [data, order];
  const { reconciliation: _r, ...rest } = order;
  void _r;
  return withEvent(data, rest as Order, 'note', `Reconciliation reopened — ${why}`, at);
}

function validateOrderInput(input: OrderInput) {
  if (!input.customerName.trim()) fail('Enter the customer name');
  if (input.customerPhone && !/^\d{10}$/.test(input.customerPhone)) fail('Enter a 10-digit mobile number');
  if (input.category === 'Other' && !input.categoryOther?.trim()) fail('Describe the item (e.g. Mangalsutra, Bangle)');
  if (!input.purity.trim()) fail('Choose the purity');
  assertWeight(input.expectedWeight, 'Expected weight');
  assertDate(input.orderDate, 'order date');
  assertDate(input.deliveryDate, 'delivery date');
  if (input.deliveryDate < input.orderDate) fail('Delivery date cannot be before the order date');
  assertAmount(input.advance, 'Advance');
  assertAmount(input.makingCharges, 'Making charges');
  assertAmount(input.estimatedTotal, 'Estimated total');
  if (input.advance > input.estimatedTotal && input.estimatedTotal > 0)
    fail('Advance is more than the estimated total — please check the amounts');
}

// ---------- orders ----------

export function createOrder(data: AppData, input: OrderInput, now = new Date()): Result {
  validateOrderInput(input);
  const at = now.toISOString();
  const [d1, n] = nextCounter(data, 'order');
  const id = `KS-${n}`;
  const order: Order = {
    ...input,
    id,
    customerName: input.customerName.trim(),
    purity: normalisePurity(input.purity),
    description: input.description.trim(),
    status: 'new',
    payments: [],
    timeline: [],
    createdAt: at,
    updatedAt: at,
  };
  const [d2, withCreated] = withEvent(d1, order, 'created', `Order taken from ${order.customerName}`, at);
  return { data: { ...d2, orders: [...d2.orders, withCreated] }, id };
}

export function updateOrder(data: AppData, orderId: string, input: OrderInput, now = new Date()): AppData {
  validateOrderInput(input);
  const at = now.toISOString();
  const old = getOrder(data, orderId);
  let next: Order = {
    ...old,
    ...input,
    customerName: input.customerName.trim(),
    purity: normalisePurity(input.purity),
    description: input.description.trim(),
    updatedAt: at,
  };
  let d = data;
  const changes: string[] = [];
  if (old.deliveryDate !== next.deliveryDate)
    changes.push(`delivery date ${formatDate(old.deliveryDate)} → ${formatDate(next.deliveryDate)}`);
  if (old.estimatedTotal !== next.estimatedTotal)
    changes.push(`estimated total ${formatINR(old.estimatedTotal)} → ${formatINR(next.estimatedTotal)}`);
  if (old.advance !== next.advance) changes.push(`advance ${formatINR(old.advance)} → ${formatINR(next.advance)}`);
  if (old.expectedWeight !== next.expectedWeight)
    changes.push(`expected weight ${formatGrams(old.expectedWeight)} → ${formatGrams(next.expectedWeight)}`);
  if (changes.length) [d, next] = withEvent(d, next, 'note', `Order details edited: ${changes.join('; ')}`, at);
  return replaceOrder(d, next);
}

export function assignKarigar(
  data: AppData,
  orderId: string,
  a: { karigarId: string; assignedDate: string; expectedCompletionDate: string; note?: string },
  now = new Date(),
): AppData {
  const order = getOrder(data, orderId);
  const karigar = getKarigar(data, a.karigarId);
  if (karigar.archived) fail(`${karigar.name} is archived. Restore them before assigning work.`);
  if (order.status === 'delivered' || order.status === 'cancelled') fail('This order is already closed');
  assertDate(a.assignedDate, 'assignment date');
  assertDate(a.expectedCompletionDate, 'expected completion date');
  if (a.expectedCompletionDate < a.assignedDate) fail('Expected completion cannot be before the assignment date');

  const prev = order.assignment?.karigarId;
  if (prev && prev !== a.karigarId) {
    const gold = orderGoldSummary(order, data.transactions, data.settings.toleranceGrams);
    const stillWithPrev = gold.lines.some((l) => toMg(l.unaccounted) !== 0);
    if (stillWithPrev) {
      const prevName = getKarigar(data, prev).name;
      fail(`Gold for this order is still with ${prevName}. Record the gold returned (or void the issue entry) before reassigning.`);
    }
  }
  const at = now.toISOString();
  const summary =
    prev && prev !== a.karigarId
      ? `Reassigned from ${getKarigar(data, prev).name} to ${karigar.name} · due back ${formatDate(a.expectedCompletionDate)}`
      : prev
        ? `Assignment updated for ${karigar.name} · due back ${formatDate(a.expectedCompletionDate)}`
        : `Assigned to ${karigar.name} · due back ${formatDate(a.expectedCompletionDate)}`;
  let next: Order = {
    ...order,
    assignment: { karigarId: a.karigarId, assignedDate: a.assignedDate, expectedCompletionDate: a.expectedCompletionDate },
    status: order.status === 'new' ? 'assigned' : order.status,
  };
  let d: AppData;
  [d, next] = withEvent(data, next, 'assigned', summary, at, a.note);
  return replaceOrder(d, next);
}

export function issueGold(
  data: AppData,
  orderId: string,
  g: { purity: Purity; weight: number; date: string; notes?: string },
  now = new Date(),
): Result {
  let order = getOrder(data, orderId);
  if (!order.assignment) fail('Assign a karigar before issuing gold');
  if (order.status === 'delivered' || order.status === 'cancelled') fail('This order is already closed');
  assertWeight(g.weight, 'Gold weight', { positive: true });
  assertDate(g.date, 'date of issue');
  if (!g.purity.trim()) fail('Choose the gold purity');
  const karigar = getKarigar(data, order.assignment.karigarId);
  const at = now.toISOString();
  let d: AppData;
  [d, order] = reopenIfClosed(data, order, at, 'more gold issued');
  let ids: string[];
  [d, ids] = addTxns(
    d,
    [{ date: g.date, karigarId: karigar.id, orderId, type: 'issue', purity: g.purity, weight: g.weight, notes: g.notes?.trim() || undefined }],
    at,
  );
  const statusNext: OrderStatus = order.status === 'new' || order.status === 'assigned' ? 'gold_issued' : order.status;
  [d, order] = withEvent(
    d,
    { ...order, status: statusNext },
    'gold_issued',
    `Issued ${formatGrams(g.weight)} of ${normalisePurity(g.purity)} gold to ${karigar.name} (${ids[0]})`,
    at,
    g.notes,
  );
  return { data: replaceOrder(d, order), id: ids[0]! };
}

export function markWorkStarted(data: AppData, orderId: string, note?: string, now = new Date()): AppData {
  let order = getOrder(data, orderId);
  if (!order.assignment) fail('Assign a karigar first');
  if (!['assigned', 'gold_issued'].includes(order.status)) fail('Work can only be started on an assigned order');
  const name = getKarigar(data, order.assignment.karigarId).name;
  let d: AppData;
  [d, order] = withEvent(data, { ...order, status: 'in_progress' }, 'work_started', `${name} started work`, now.toISOString(), note);
  return replaceOrder(d, order);
}

export interface ReturnInput {
  purity: Purity;
  finished: number;
  scrap: number;
  approvedLoss: number;
  date: string;
  notes?: string;
}

/**
 * Record the item (and gold) coming back from the karigar. Creates up to three ledger entries:
 * Finished Gold Returned, Scrap Returned and an Adjustment for approved process loss.
 * Pass gold = null for jobs where no shop gold was issued (e.g. some repairs).
 */
export function receiveItem(
  data: AppData,
  orderId: string,
  r: { gold: Omit<ReturnInput, 'date' | 'notes'> | null; date: string; notes?: string },
  now = new Date(),
): AppData {
  let order = getOrder(data, orderId);
  if (!order.assignment) fail('Assign a karigar first');
  if (order.status === 'delivered' || order.status === 'cancelled') fail('This order is already closed');
  assertDate(r.date, 'date received');
  const karigar = getKarigar(data, order.assignment.karigarId);
  const at = now.toISOString();
  let d = data;
  let summary = `Item received back from ${karigar.name}`;

  if (r.gold) {
    const { finished, scrap, approvedLoss } = r.gold;
    const purity = normalisePurity(r.gold.purity);
    assertWeight(finished, 'Finished metal weight');
    assertWeight(scrap, 'Scrap returned');
    assertWeight(approvedLoss, 'Approved process loss');
    if (finished + scrap + approvedLoss <= 0) fail('Enter at least one weight that came back');
    const issuedThisPurity = d.transactions.some(
      (t) => !t.voided && t.orderId === orderId && t.type === 'issue' && normalisePurity(t.purity) === purity,
    );
    if (!issuedThisPurity) fail(`No ${purity} gold was issued on this order. Check the purity.`);

    [d, order] = reopenIfClosed(d, order, at, 'more gold received');
    const batchId = `RB-${d.counters.misc + 1}`;
    [d] = nextCounter(d, 'misc');
    const notes = r.notes?.trim() || undefined;
    const base = { date: r.date, karigarId: karigar.id, orderId, purity, batchId, notes };
    const entries: Array<Omit<GoldTransaction, 'id' | 'createdAt'>> = [];
    if (finished > 0) entries.push({ ...base, type: 'finished_return', weight: finished });
    if (scrap > 0) entries.push({ ...base, type: 'scrap_return', weight: scrap });
    if (approvedLoss > 0)
      entries.push({ ...base, type: 'adjustment', weight: approvedLoss, direction: 'reduce', reason: 'approved_loss' });
    [d] = addTxns(d, entries, at);
    const parts = [
      finished > 0 && `finished ${formatGrams(finished)}`,
      scrap > 0 && `scrap ${formatGrams(scrap)}`,
      approvedLoss > 0 && `approved loss ${formatGrams(approvedLoss)}`,
    ].filter(Boolean);
    summary = `Received from ${karigar.name}: ${parts.join(', ')} (${purity})`;
  }

  const before: OrderStatus[] = ['new', 'assigned', 'gold_issued', 'in_progress'];
  const status: OrderStatus = before.includes(order.status) ? 'received' : order.status;
  [d, order] = withEvent(d, { ...order, status }, 'item_received', summary, at, r.notes);
  return replaceOrder(d, order);
}

export function completeReconciliation(
  data: AppData,
  orderId: string,
  c: { resolution: 'kept_with_karigar' | 'accepted_as_loss'; note?: string; date: string },
  now = new Date(),
): AppData {
  let order = getOrder(data, orderId);
  const tol = data.settings.toleranceGrams;
  const summary = orderGoldSummary(order, data.transactions, tol);
  if (summary.status === 'no_gold') fail('No gold was issued on this order, so there is nothing to reconcile');
  if (summary.status === 'awaiting_return') fail('Record what the karigar returned before reconciling');
  if (order.reconciliation) fail('Reconciliation is already complete');
  if (summary.status === 'discrepancy' && !c.note?.trim())
    fail('The difference is more than your tolerance — add a note explaining it');
  assertDate(c.date, 'date');

  const at = now.toISOString();
  const nonZero = summary.lines.filter((l) => toMg(l.unaccounted) !== 0);
  let d = data;
  const karigarId = order.assignment!.karigarId;
  if (c.resolution === 'accepted_as_loss' && nonZero.length) {
    [d] = addTxns(
      d,
      nonZero.map((l) => ({
        date: c.date,
        karigarId,
        orderId,
        type: 'adjustment' as const,
        purity: l.purity,
        weight: Math.abs(l.unaccounted),
        direction: (l.unaccounted > 0 ? 'reduce' : 'increase') as AdjustmentDirection,
        reason: 'accepted_difference' as const,
        notes: c.note?.trim() || 'Difference accepted at reconciliation',
      })),
      at,
    );
  }
  const unaccountedAtCompletion = Object.fromEntries(summary.lines.map((l) => [l.purity, l.unaccounted]));
  const resolution = nonZero.length === 0 ? 'none' : c.resolution;
  const text =
    nonZero.length === 0
      ? 'Gold reconciled — fully accounted for'
      : resolution === 'accepted_as_loss'
        ? `Gold reconciled — ${nonZero.map((l) => `${formatGrams(Math.abs(l.unaccounted))} ${l.purity}`).join(', ')} accepted as loss (adjustment recorded)`
        : `Reconciliation closed — ${nonZero.map((l) => `${formatGrams(Math.abs(l.unaccounted))} ${l.purity}`).join(', ')} kept against karigar's balance`;
  [d, order] = withEvent(
    d,
    { ...order, reconciliation: { completedAt: at, unaccountedAtCompletion, resolution, note: c.note?.trim() || undefined } },
    'reconciled',
    text,
    at,
    c.note,
  );
  return replaceOrder(d, order);
}

const STATUS_EVENT: Partial<Record<OrderStatus, TimelineEventType>> = {
  in_progress: 'work_started',
  received: 'item_received',
  ready: 'ready',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

export function setStatus(data: AppData, orderId: string, status: OrderStatus, note?: string, now = new Date()): AppData {
  let order = getOrder(data, orderId);
  if (order.status === status) fail(`Order is already "${STATUS_LABEL[status]}"`);
  if (['assigned', 'gold_issued', 'in_progress', 'received'].includes(status) && !order.assignment)
    fail('Assign a karigar first');
  const at = now.toISOString();
  const type = STATUS_EVENT[status] ?? 'status_changed';
  const summaries: Partial<Record<OrderStatus, string>> = {
    ready: 'Marked ready for delivery',
    delivered: `Delivered to ${order.customerName}`,
    cancelled: 'Order cancelled',
  };
  const summary = summaries[status] ?? `Status changed: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[status]}`;
  let d: AppData;
  [d, order] = withEvent(data, { ...order, status }, type, summary, at, note);
  return replaceOrder(d, order);
}

export function addTimelineNote(data: AppData, orderId: string, note: string, now = new Date()): AppData {
  if (!note.trim()) fail('Write a note first');
  let order = getOrder(data, orderId);
  let d: AppData;
  [d, order] = withEvent(data, order, 'note', 'Note added', now.toISOString(), note);
  return replaceOrder(d, order);
}

export function editEventNote(data: AppData, orderId: string, eventId: string, note: string): AppData {
  const order = getOrder(data, orderId);
  if (!order.timeline.some((e) => e.id === eventId)) fail('That timeline event was not found');
  const timeline = order.timeline.map((e) => {
    if (e.id !== eventId) return e;
    const { note: _n, ...rest } = e;
    void _n;
    return note.trim() ? { ...rest, note: note.trim() } : rest;
  });
  return replaceOrder(data, { ...order, timeline });
}

export function recordPayment(
  data: AppData,
  orderId: string,
  p: { amount: number; date: string; note?: string },
  now = new Date(),
): AppData {
  let order = getOrder(data, orderId);
  assertAmount(p.amount, 'Amount');
  if (p.amount <= 0) fail('Amount must be more than ₹0');
  assertDate(p.date, 'payment date');
  const [d1, n] = nextCounter(data, 'misc');
  const payment = { id: `PM-${n}`, date: p.date, amount: p.amount, note: p.note?.trim() || undefined };
  let d: AppData;
  [d, order] = withEvent(
    d1,
    { ...order, payments: [...order.payments, payment] },
    'payment',
    `Payment received: ${formatINR(p.amount)}`,
    now.toISOString(),
    p.note,
  );
  return replaceOrder(d, order);
}

// ---------- ledger ----------

export function voidTransaction(data: AppData, txnId: string, reason: string, now = new Date()): AppData {
  const txn = data.transactions.find((t) => t.id === txnId) ?? fail('Entry not found');
  if (txn.voided) fail('This entry is already voided');
  if (!reason.trim()) fail('Give a reason for voiding this entry');
  const at = now.toISOString();
  let d: AppData = {
    ...data,
    transactions: data.transactions.map((t) => (t.id === txnId ? { ...t, voided: { at, reason: reason.trim() } } : t)),
  };
  if (txn.orderId) {
    let order = getOrder(d, txn.orderId);
    [d, order] = reopenIfClosed(d, order, at, `${txnId} voided`);
    [d, order] = withEvent(d, order, 'entry_voided', `Ledger entry ${txnId} voided (${formatGrams(txn.weight)} ${txn.purity})`, at, reason);
    d = replaceOrder(d, order);
  }
  return d;
}

export function addAdjustment(
  data: AppData,
  a: { karigarId: string; orderId?: string; purity: Purity; weight: number; direction: AdjustmentDirection; date: string; notes: string },
  now = new Date(),
): Result {
  getKarigar(data, a.karigarId);
  assertWeight(a.weight, 'Weight', { positive: true });
  assertDate(a.date, 'date');
  if (!a.purity.trim()) fail('Choose the purity');
  if (!a.notes.trim()) fail('Explain why this adjustment is being made');
  const at = now.toISOString();
  let order = a.orderId ? getOrder(data, a.orderId) : undefined;
  if (order && order.assignment?.karigarId !== a.karigarId) fail(`${a.orderId} is not assigned to this karigar`);
  let d = data;
  if (order) [d, order] = reopenIfClosed(d, order, at, 'adjustment recorded');
  let ids: string[];
  [d, ids] = addTxns(
    d,
    [{ date: a.date, karigarId: a.karigarId, orderId: a.orderId || undefined, type: 'adjustment', purity: a.purity, weight: a.weight, direction: a.direction, reason: 'manual', notes: a.notes.trim() }],
    at,
  );
  if (order) {
    [d, order] = withEvent(
      d,
      order,
      'note',
      `Adjustment ${ids[0]}: ${a.direction === 'reduce' ? '−' : '+'}${formatGrams(a.weight)} ${normalisePurity(a.purity)}`,
      at,
      a.notes,
    );
    d = replaceOrder(d, order);
  }
  return { data: d, id: ids[0]! };
}

// ---------- karigars ----------

function validateKarigar(k: KarigarInput) {
  if (!k.name.trim()) fail('Enter the karigar name');
  if (k.phone && !/^\d{10}$/.test(k.phone)) fail('Enter a 10-digit mobile number');
}

export function addKarigar(data: AppData, k: KarigarInput, now = new Date()): Result {
  validateKarigar(k);
  if (data.karigars.some((x) => x.name.trim().toLowerCase() === k.name.trim().toLowerCase()))
    fail(`A karigar named ${k.name.trim()} already exists`);
  const [d, n] = nextCounter(data, 'karigar');
  const id = `K-${n}`;
  const karigar: Karigar = {
    id,
    name: k.name.trim(),
    phone: k.phone,
    specialisation: k.specialisation.trim(),
    notes: k.notes?.trim() || undefined,
    archived: false,
    createdAt: now.toISOString(),
  };
  return { data: { ...d, karigars: [...d.karigars, karigar] }, id };
}

export function updateKarigar(data: AppData, id: string, k: KarigarInput): AppData {
  validateKarigar(k);
  getKarigar(data, id);
  if (data.karigars.some((x) => x.id !== id && x.name.trim().toLowerCase() === k.name.trim().toLowerCase()))
    fail(`Another karigar is already named ${k.name.trim()}`);
  return {
    ...data,
    karigars: data.karigars.map((x) =>
      x.id === id ? { ...x, name: k.name.trim(), phone: k.phone, specialisation: k.specialisation.trim(), notes: k.notes?.trim() || undefined } : x,
    ),
  };
}

export function setKarigarArchived(data: AppData, id: string, archived: boolean): AppData {
  getKarigar(data, id);
  return { ...data, karigars: data.karigars.map((x) => (x.id === id ? { ...x, archived } : x)) };
}

// ---------- settings ----------

export function updateSettings(data: AppData, s: Settings): AppData {
  if (!s.shopName.trim()) fail('Enter the shop name');
  if (!Number.isFinite(s.toleranceGrams) || s.toleranceGrams < 0) fail('Tolerance cannot be negative');
  if (s.toleranceGrams > 10) fail('Tolerance above 10 g looks too high — please check');
  if (!Number.isInteger(s.dueSoonDays) || s.dueSoonDays < 0 || s.dueSoonDays > 60) fail('"Due soon" must be 0–60 days');
  if (!Number.isInteger(s.staleJobDays) || s.staleJobDays < 1 || s.staleJobDays > 90) fail('"No update" alert must be 1–90 days');
  return { ...data, settings: { ...s, shopName: s.shopName.trim() } };
}
