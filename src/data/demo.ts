// Illustrative demo data for a fictional shop. All names, phone numbers and orders are made up.
//
// The demo is built by replaying real operations (createOrder, issueGold, receiveItem …) with
// back-dated clocks, so the ledger, timelines and statuses are internally consistent by construction.
// Dates are relative to the day the demo is loaded, so "overdue" and "due soon" always make sense.

import { toISODate } from '../lib/dates';
import type { AppData, Settings } from '../lib/types';
import * as ops from '../store/operations';
import type { OrderInput } from '../store/operations';

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'My Jewellery Shop',
  ownerName: '',
  phone: '',
  address: '',
  toleranceGrams: 0.1,
  currency: 'INR',
  dueSoonDays: 3,
  staleJobDays: 7,
};

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    isDemo: false,
    settings: { ...DEFAULT_SETTINGS },
    karigars: [],
    orders: [],
    transactions: [],
    counters: { order: 1000, txn: 0, karigar: 0, misc: 0 },
  };
}

type Step = { day: number; hour: number; run: (d: AppData, now: Date, date: string) => AppData };

export function buildDemoData(today: Date = new Date()): AppData {
  const at = (day: number, hour: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    d.setHours(hour, (Math.abs(day) * 7 + hour * 13) % 60, 0, 0);
    return d;
  };
  const dateOf = (day: number) => toISODate(at(day, 12));

  let data: AppData = {
    ...emptyData(),
    isDemo: true,
    seededOn: toISODate(today),
    settings: {
      ...DEFAULT_SETTINGS,
      shopName: 'Shree Laxmi Jewellers',
      ownerName: 'Mahesh Soni',
      phone: '9826000000',
      address: 'Sarafa Bazaar, Ratlam, Madhya Pradesh',
    },
  };

  const karigars: ops.KarigarInput[] = [
    { name: 'Ramesh Soni', phone: '9826041127', specialisation: 'Rings & bangles', notes: 'Works from home workshop near Chandni Chowk. Prefers 22K.' },
    { name: 'Abdul Rahim Shaikh', phone: '9754022381', specialisation: 'Necklaces & filigree', notes: 'Takes 3–4 weeks for heavy necklaces.' },
    { name: 'Bapi Karmakar', phone: '9425067314', specialisation: 'Earrings & jhumkas', notes: 'Bengali-style fine work.' },
    { name: 'Suresh Verma', phone: '9907015846', specialisation: 'Repairs, soldering & polishing', notes: '' },
  ];
  for (const k of karigars) data = ops.addKarigar(data, k, at(-120, 11)).data;
  const [RAMESH, ABDUL, BAPI, SURESH] = data.karigars.map((k) => k.id) as [string, string, string, string];

  const base = { metalType: 'Yellow gold' as const, designImage: undefined, categoryOther: undefined };
  const orders: Array<{ day: number; input: OrderInput }> = [
    { day: -50, input: { ...base, customerName: 'Neha Kulkarni', customerPhone: '9893112045', orderType: 'Custom', category: 'Earrings', purity: '18K', expectedWeight: 5.6, orderDate: dateOf(-50), deliveryDate: dateOf(-30), advance: 10000, makingCharges: 4500, estimatedTotal: 38000, description: 'Daily-wear stud earrings, round with small petal edge. Screw back.' } },
    { day: -40, input: { ...base, customerName: 'Sunita Agarwal', customerPhone: '9826112345', orderType: 'Custom', category: 'Ring', purity: '22K', expectedWeight: 6.5, orderDate: dateOf(-40), deliveryDate: dateOf(-20), advance: 5000, makingCharges: 4500, estimatedTotal: 52000, description: 'Ladies ring with floral top and a small red stone in the centre. Ring size 14.' } },
    { day: -35, input: { ...base, customerName: 'Meena Jain', customerPhone: '9425118890', orderType: 'Custom', category: 'Necklace', purity: '22K', expectedWeight: 28, orderDate: dateOf(-35), deliveryDate: dateOf(6), advance: 50000, makingCharges: 22400, estimatedTotal: 215000, description: 'Temple-style necklace with 7 Lakshmi coin pendants, matte finish. Length 16 inches. For daughter\'s wedding.' } },
    { day: -30, input: { ...base, customerName: 'Priya Sharma', customerPhone: '9179234567', orderType: 'Custom', category: 'Earrings', purity: '22K', expectedWeight: 12, orderDate: dateOf(-30), deliveryDate: dateOf(2), advance: 20000, makingCharges: 9600, estimatedTotal: 98000, description: 'Pair of jhumkas with bead drops, medium size. Same design as photo shown on WhatsApp.' } },
    { day: -28, input: { ...base, metalType: 'White gold', customerName: 'Rajesh Patel', customerPhone: '9302245678', orderType: 'Custom', category: 'Bracelet', purity: '18K', expectedWeight: 15, orderDate: dateOf(-28), deliveryDate: dateOf(-4), advance: 15000, makingCharges: 12000, estimatedTotal: 95000, description: 'Gents bracelet, flat link pattern, box clasp. 8 inch length.' } },
    { day: -25, input: { ...base, customerName: 'Lakshmi Iyer', customerPhone: '9752301122', orderType: 'Custom', category: 'Other', categoryOther: 'Bangles (pair)', purity: '22K', expectedWeight: 19.5, orderDate: dateOf(-25), deliveryDate: dateOf(3), advance: 40000, makingCharges: 15600, estimatedTotal: 148000, description: 'Pair of plain bangles with fine diamond-cut pattern. Size 2.6.' } },
    { day: -14, input: { ...base, customerName: 'Anil Gupta', customerPhone: '9827345566', orderType: 'Repair', category: 'Other', categoryOther: 'Chain', purity: '22K', expectedWeight: 18.24, orderDate: dateOf(-14), deliveryDate: dateOf(5), advance: 0, makingCharges: 800, estimatedTotal: 4200, description: 'Customer\'s own chain (18.240 g as received). Broken link repair and new lobster clasp.' } },
    { day: -12, input: { ...base, metalType: 'Rose gold', customerName: 'Kavita Deshmukh', customerPhone: '9406556677', orderType: 'Custom', category: 'Ring', purity: '18K', expectedWeight: 4.5, orderDate: dateOf(-12), deliveryDate: dateOf(2), advance: 3000, makingCharges: 3600, estimatedTotal: 28000, description: 'Solitaire-style ring for customer\'s own stone. Ring size 12.' } },
    { day: -3, input: { ...base, customerName: 'Deepak Joshi', customerPhone: '9893667788', orderType: 'Custom', category: 'Ring', purity: '22K', expectedWeight: 8, orderDate: dateOf(-3), deliveryDate: dateOf(12), advance: 8000, makingCharges: 5600, estimatedTotal: 62000, description: 'Gents ring with initials "DJ" on top, matte background. Ring size 22.' } },
    { day: -1, input: { ...base, customerName: 'Fatima Shaikh', customerPhone: '9584778899', orderType: 'Custom', category: 'Other', categoryOther: 'Mangalsutra', purity: '22K', expectedWeight: 10, orderDate: dateOf(-1), deliveryDate: dateOf(18), advance: 10000, makingCharges: 7000, estimatedTotal: 78000, description: 'Short mangalsutra, black beads with small gold vati pendant. 18 inches.' } },
  ];
  const id = (n: number) => `KS-${1000 + n}`;

  const steps: Step[] = orders.map((o) => ({ day: o.day, hour: 11, run: (d, now) => ops.createOrder(d, o.input, now).data }));
  const add = (day: number, hour: number, run: Step['run']) => steps.push({ day, hour, run });
  const assign = (n: number, day: number, karigarId: string, dueDay: number, note?: string) =>
    add(day, 12, (d, now, date) => ops.assignKarigar(d, id(n), { karigarId, assignedDate: date, expectedCompletionDate: dateOf(dueDay), note }, now));
  const issue = (n: number, day: number, purity: string, weight: number, notes?: string) =>
    add(day, 13, (d, now, date) => ops.issueGold(d, id(n), { purity, weight, date, notes }, now).data);
  const start = (n: number, day: number, note?: string) => add(day, 17, (d, now) => ops.markWorkStarted(d, id(n), note, now));
  const receive = (n: number, day: number, purity: string, finished: number, scrap: number, approvedLoss: number, notes?: string) =>
    add(day, 15, (d, now, date) => ops.receiveItem(d, id(n), { gold: { purity, finished, scrap, approvedLoss }, date, notes }, now));
  const reconcile = (n: number, day: number, note?: string) =>
    add(day, 16, (d, now, date) => ops.completeReconciliation(d, id(n), { resolution: 'accepted_as_loss', note, date }, now));
  const status = (n: number, day: number, hour: number, s: Parameters<typeof ops.setStatus>[2], note?: string) =>
    add(day, hour, (d, now) => ops.setStatus(d, id(n), s, note, now));
  const pay = (n: number, day: number, amount: number, note?: string) =>
    add(day, 18, (d, now, date) => ops.recordPayment(d, id(n), { amount, date, note }, now));
  const note = (n: number, day: number, text: string) => add(day, 19, (d, now) => ops.addTimelineNote(d, id(n), text, now));

  // KS-1001 Neha — delivered, fully reconciled
  assign(1, -49, BAPI, -34);
  issue(1, -49, '18K', 6.0);
  start(1, -48);
  receive(1, -33, '18K', 5.62, 0.28, 0.09);
  reconcile(1, -33, 'Within weighing tolerance');
  status(1, -32, 11, 'ready');
  status(1, -31, 17, 'delivered', 'Customer collected in person');
  pay(1, -31, 28000, 'Balance paid in cash');

  // KS-1002 Sunita — delivered, fully reconciled
  assign(2, -39, RAMESH, -25);
  issue(2, -38, '22K', 7.0);
  start(2, -37);
  receive(2, -24, '22K', 6.48, 0.42, 0.09);
  reconcile(2, -24, 'Within weighing tolerance');
  status(2, -23, 11, 'ready');
  status(2, -21, 17, 'delivered');
  pay(2, -21, 47000, 'UPI');

  // KS-1003 Meena — received back with 0.700 g unaccounted (deliberate discrepancy)
  assign(3, -34, ABDUL, -3, 'Heavy piece — karigar asked for 30 g up front');
  issue(3, -34, '22K', 30.0);
  start(3, -33);
  note(3, -15, 'Karigar sent progress photo on WhatsApp. Coins done, chain pending.');
  receive(3, -2, '22K', 27.85, 1.2, 0.25, 'Karigar says extra solder was used. To verify scrap weight again.');

  // KS-1004 Priya — reconciled, ready for delivery (not yet collected)
  assign(4, -29, BAPI, -6);
  issue(4, -29, '22K', 13.0);
  start(4, -28);
  receive(4, -5, '22K', 12.15, 0.65, 0.18);
  reconcile(4, -5, 'Within weighing tolerance');
  status(4, -4, 12, 'ready', 'Called customer — said she will collect this week');

  // KS-1005 Rajesh — overdue, still with karigar. Includes one voided typo entry.
  assign(5, -27, RAMESH, -7);
  issue(5, -27, '18K', 16.05);
  add(-27, 14, (d, now) => {
    const typo = d.transactions.filter((t) => t.orderId === id(5) && t.type === 'issue').at(-1)!;
    return ops.voidTransaction(d, typo.id, 'Typing mistake — actual weight was 16.500 g, re-entered', now);
  });
  add(-27, 15, (d, now, date) => ops.issueGold(d, id(5), { purity: '18K', weight: 16.5, date }, now).data);
  start(5, -26);
  note(5, -6, 'Karigar says 3 more days needed — clasp fitting pending.');

  // KS-1006 Lakshmi — received, within tolerance, owner still has to close reconciliation
  assign(6, -24, RAMESH, -1);
  issue(6, -24, '22K', 20.0);
  start(6, -23);
  receive(6, -1, '22K', 19.42, 0.38, 0.15);

  // KS-1007 Anil — repair, small gold issued, no update from karigar for a while
  assign(7, -13, SURESH, -6);
  issue(7, -13, '22K', 0.5, 'For new clasp and solder');

  // KS-1008 Kavita — in progress, due in 2 days
  assign(8, -11, BAPI, 1);
  issue(8, -11, '18K', 5.2);
  start(8, -10);
  note(8, -2, 'Stone setting done. Polishing remaining.');

  // KS-1009 Deepak — assigned, gold not yet issued
  assign(9, -2, ABDUL, 9);

  // KS-1010 Fatima — new, not yet assigned

  steps.sort((a, b) => a.day - b.day || a.hour - b.hour);
  for (const s of steps) {
    const now = at(s.day, s.hour);
    data = s.run(data, now, toISODate(now));
  }
  return data;
}
