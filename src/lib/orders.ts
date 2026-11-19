// Order-level rules: labels, overdue/due-soon logic, staleness and "attention" alerts.
// Pure functions — used by every page so the rules live in one place.

import { daysBetween } from './dates';
import { exceedsTolerance, orderGoldSummary, type ReconStatus } from './calculations';
import type { AppData, GoldTxnType, Order, OrderStatus } from './types';
import { formatGrams } from './format';

export const STATUS_ORDER: OrderStatus[] = [
  'new',
  'assigned',
  'gold_issued',
  'in_progress',
  'received',
  'ready',
  'delivered',
  'cancelled',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New — not assigned',
  assigned: 'Karigar assigned',
  gold_issued: 'Gold issued',
  in_progress: 'Work in progress',
  received: 'Item received',
  ready: 'Ready for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_SHORT: Record<OrderStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  gold_issued: 'Gold issued',
  in_progress: 'In progress',
  received: 'Received',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const TXN_TYPE_LABEL: Record<GoldTxnType, string> = {
  issue: 'Gold Issued',
  finished_return: 'Finished Gold Returned',
  scrap_return: 'Scrap Returned',
  adjustment: 'Adjustment',
};

export const RECON_LABEL: Record<ReconStatus, string> = {
  no_gold: 'No gold issued',
  awaiting_return: 'Awaiting return',
  pending: 'Ready to reconcile',
  discrepancy: 'Difference found',
  completed: 'Reconciled',
  completed_with_difference: 'Closed with difference',
};

/** Statuses where the job is physically with the karigar. */
export const WITH_KARIGAR: OrderStatus[] = ['assigned', 'gold_issued', 'in_progress'];

export const isOpen = (o: Order) => o.status !== 'delivered' && o.status !== 'cancelled';

export function isOverdue(o: Order, today: string): boolean {
  return isOpen(o) && o.deliveryDate < today;
}

export function isDueSoon(o: Order, today: string, days: number): boolean {
  if (!isOpen(o)) return false;
  const diff = daysBetween(today, o.deliveryDate);
  return diff >= 0 && diff <= days;
}

export function itemLabel(o: Pick<Order, 'category' | 'categoryOther'>): string {
  return o.category === 'Other' ? o.categoryOther?.trim() || 'Other item' : o.category;
}

/** "22K Necklace" / "Repair · 22K Bracelet" */
export function itemTitle(o: Order): string {
  const base = `${o.purity} ${itemLabel(o)}`;
  return o.orderType === 'Repair' ? `Repair · ${base}` : base;
}

export function lastActivityAt(o: Order): string {
  return o.timeline.reduce((latest, e) => (e.at > latest ? e.at : latest), o.createdAt);
}

export function daysSinceUpdate(o: Order, today: string): number {
  return daysBetween(lastActivityAt(o).slice(0, 10), today);
}

export function isStale(o: Order, today: string, staleDays: number): boolean {
  return WITH_KARIGAR.includes(o.status) && !!o.assignment && daysSinceUpdate(o, today) >= staleDays;
}

export type AttentionKind = 'overdue' | 'discrepancy' | 'ready_not_delivered' | 'stale' | 'reconcile';

export interface AttentionItem {
  kind: AttentionKind;
  severity: 'high' | 'medium' | 'low';
  orderId: string;
  title: string;
  detail: string;
}

/** Everything the owner should look at today, most serious first. */
export function attentionItems(data: AppData, today: string): AttentionItem[] {
  const { settings, karigars, transactions } = data;
  const nameOf = (id?: string) => karigars.find((k) => k.id === id)?.name ?? 'karigar';
  const items: AttentionItem[] = [];

  for (const o of data.orders) {
    if (o.status === 'cancelled') continue;
    const gold = orderGoldSummary(o, transactions, settings.toleranceGrams);

    if (gold.status === 'discrepancy') {
      const line = gold.lines.find((l) => exceedsTolerance(l.unaccounted, settings.toleranceGrams));
      items.push({
        kind: 'discrepancy',
        severity: 'high',
        orderId: o.id,
        title: `Gold does not reconcile — ${o.id}`,
        detail: line
          ? `${formatGrams(Math.abs(line.unaccounted))} of ${line.purity} ${line.unaccounted > 0 ? 'unaccounted' : 'extra returned'} with ${nameOf(o.assignment?.karigarId)} (tolerance ${formatGrams(settings.toleranceGrams)})`
          : 'Difference beyond tolerance',
      });
    }

    if (isOverdue(o, today)) {
      const late = daysBetween(o.deliveryDate, today);
      items.push({
        kind: 'overdue',
        severity: 'high',
        orderId: o.id,
        title: `Delivery date passed — ${o.id}`,
        detail: `${o.customerName}'s ${itemLabel(o).toLowerCase()} was due ${late} day${late === 1 ? '' : 's'} ago · ${STATUS_SHORT[o.status]}`,
      });
    }

    if (o.status === 'ready') {
      const readyEvent = [...o.timeline].reverse().find((e) => e.type === 'ready');
      const waiting = readyEvent ? daysBetween(readyEvent.at.slice(0, 10), today) : 0;
      items.push({
        kind: 'ready_not_delivered',
        severity: 'medium',
        orderId: o.id,
        title: `Ready, not yet delivered — ${o.id}`,
        detail: `${o.customerName} · ready ${waiting <= 0 ? 'today' : `for ${waiting} day${waiting === 1 ? '' : 's'}`} — inform the customer`,
      });
    }

    if (isStale(o, today, settings.staleJobDays)) {
      const d = daysSinceUpdate(o, today);
      items.push({
        kind: 'stale',
        severity: 'medium',
        orderId: o.id,
        title: `No update from karigar — ${o.id}`,
        detail: `${nameOf(o.assignment?.karigarId)} · last update ${d} days ago`,
      });
    }

    if (gold.status === 'pending') {
      items.push({
        kind: 'reconcile',
        severity: 'low',
        orderId: o.id,
        title: `Close the gold record — ${o.id}`,
        detail: 'Item received and within tolerance. Confirm reconciliation to close it.',
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.orderId.localeCompare(b.orderId));
}

export interface KarigarJobStats {
  active: number;
  pending: number;
  completed: number;
  total: number;
}

/**
 * active    = with the karigar now (gold issued / work in progress)
 * pending   = assigned, work not yet started
 * completed = item received back (received / ready / delivered)
 */
export function karigarJobStats(karigarId: string, orders: Order[]): KarigarJobStats {
  const mine = orders.filter((o) => o.assignment?.karigarId === karigarId && o.status !== 'cancelled');
  return {
    active: mine.filter((o) => o.status === 'gold_issued' || o.status === 'in_progress').length,
    pending: mine.filter((o) => o.status === 'assigned').length,
    completed: mine.filter((o) => ['received', 'ready', 'delivered'].includes(o.status)).length,
    total: mine.length,
  };
}

export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'month' | 'custom';

export interface OrderFilters {
  q: string;
  status: OrderStatus | 'all' | 'open';
  karigar: string; // 'all' | 'none' | karigarId
  due: DueFilter;
  from?: string;
  to?: string;
  recon?: 'all' | 'attention';
}

export function filterOrders(data: AppData, f: OrderFilters, today: string): Order[] {
  const q = f.q.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const tol = data.settings.toleranceGrams;
  return data.orders
    .filter((o) => {
      if (q) {
        const karigar = data.karigars.find((k) => k.id === o.assignment?.karigarId)?.name ?? '';
        const hay = [o.id, o.customerName, itemLabel(o), o.description, karigar, o.purity].join(' ').toLowerCase();
        const phoneHit = qDigits.length >= 3 && o.customerPhone.includes(qDigits);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      if (f.status === 'open' && !isOpen(o)) return false;
      if (f.status !== 'all' && f.status !== 'open' && o.status !== f.status) return false;
      if (f.karigar === 'none' && o.assignment) return false;
      if (f.karigar !== 'all' && f.karigar !== 'none' && o.assignment?.karigarId !== f.karigar) return false;
      if (f.recon === 'attention') {
        const s = orderGoldSummary(o, data.transactions, tol).status;
        if (s !== 'pending' && s !== 'discrepancy') return false;
      }
      switch (f.due) {
        case 'overdue':
          return isOverdue(o, today);
        case 'today':
          return o.deliveryDate === today;
        case 'week': {
          const d = daysBetween(today, o.deliveryDate);
          return d >= 0 && d <= 7;
        }
        case 'month':
          return o.deliveryDate.slice(0, 7) === today.slice(0, 7);
        case 'custom':
          return (!f.from || o.deliveryDate >= f.from) && (!f.to || o.deliveryDate <= f.to);
        default:
          return true;
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
