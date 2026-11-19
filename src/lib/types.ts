// Core data model for KarigarSetu.
// All gold weights are stored in grams (number, up to 3 decimals).
// All money amounts are stored in rupees (number, up to 2 decimals).
// Calendar dates are stored as local 'YYYY-MM-DD' strings; timestamps as ISO strings.

export type OrderType = 'Custom' | 'Repair';
export type JewelleryCategory = 'Ring' | 'Necklace' | 'Bracelet' | 'Earrings' | 'Other';
export type MetalType = 'Yellow gold' | 'White gold' | 'Rose gold';

/** Purity label, e.g. "22K", "18K" or an owner-entered value like "14K". Never mixed in balances. */
export type Purity = string;

export type OrderStatus =
  | 'new'
  | 'assigned'
  | 'gold_issued'
  | 'in_progress'
  | 'received'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type TimelineEventType =
  | 'created'
  | 'assigned'
  | 'gold_issued'
  | 'work_started'
  | 'item_received'
  | 'reconciled'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'status_changed'
  | 'payment'
  | 'note'
  | 'entry_voided';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  /** ISO timestamp of when this happened. */
  at: string;
  /** System-generated summary, e.g. "Issued 20.000 g of 22K gold to Ramesh Soni". */
  summary: string;
  /** Owner's own note; editable. */
  note?: string;
}

export interface Assignment {
  karigarId: string;
  assignedDate: string;
  expectedCompletionDate: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Reconciliation {
  completedAt: string;
  /** Unaccounted weight at the time of completion (per purity), for the record. */
  unaccountedAtCompletion: Record<Purity, number>;
  /** How the owner chose to treat any remaining difference. */
  resolution: 'none' | 'kept_with_karigar' | 'accepted_as_loss';
  note?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  category: JewelleryCategory;
  /** Free text used when category is "Other", e.g. "Mangalsutra". */
  categoryOther?: string;
  metalType: MetalType;
  purity: Purity;
  expectedWeight: number;
  orderDate: string;
  deliveryDate: string;
  advance: number;
  makingCharges: number;
  /** Total the customer is expected to pay (may include gold value). Defaults to making charges. */
  estimatedTotal: number;
  description: string;
  /** Compressed JPEG data URL. */
  designImage?: string;
  status: OrderStatus;
  assignment?: Assignment;
  reconciliation?: Reconciliation;
  payments: Payment[];
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Karigar {
  id: string;
  name: string;
  phone: string;
  specialisation: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
}

export type GoldTxnType = 'issue' | 'finished_return' | 'scrap_return' | 'adjustment';

/**
 * Direction of an adjustment relative to the karigar's balance.
 * 'reduce' = karigar owes less (e.g. approved process loss, accepted difference).
 * 'increase' = karigar owes more (e.g. correction of an under-recorded issue).
 */
export type AdjustmentDirection = 'reduce' | 'increase';

export type AdjustmentReason = 'approved_loss' | 'accepted_difference' | 'manual';

export interface GoldTransaction {
  id: string;
  date: string;
  karigarId: string;
  orderId?: string;
  type: GoldTxnType;
  purity: Purity;
  /** Always positive, in grams. The direction comes from type (and adjustment direction). */
  weight: number;
  direction?: AdjustmentDirection;
  reason?: AdjustmentReason;
  /** Groups the entries created by one "item received" record. */
  batchId?: string;
  notes?: string;
  createdAt: string;
  /** Entries are never edited or deleted. A mistaken entry is voided with a reason and stays visible. */
  voided?: { at: string; reason: string };
}

export interface Settings {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  /** Unaccounted differences up to this many grams are treated as weighing tolerance, not flagged. */
  toleranceGrams: number;
  currency: 'INR';
  /** Orders due within this many days count as "due soon". */
  dueSoonDays: number;
  /** Jobs with karigars that have had no update for this many days are flagged. */
  staleJobDays: number;
}

export interface AppData {
  schemaVersion: 1;
  isDemo: boolean;
  seededOn?: string;
  settings: Settings;
  karigars: Karigar[];
  orders: Order[];
  transactions: GoldTransaction[];
  counters: { order: number; txn: number; karigar: number; misc: number };
}
