import { AlertTriangle, CheckCircle2, Clock, Hourglass } from 'lucide-react';
import type { ReconStatus } from '../lib/calculations';
import { cn } from '../lib/cn';
import { daysBetween, formatDate, relativeDay } from '../lib/dates';
import { formatGrams, formatGramsValue, initials } from '../lib/format';
import { isOpen, RECON_LABEL, STATUS_SHORT } from '../lib/orders';
import type { Order, OrderStatus, Purity } from '../lib/types';
import { Badge, type Tone } from './ui';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="8" fill="#1E1C19" />
        <path d="M7 22v-3a9 9 0 0 1 18 0v3" fill="none" stroke="#D9BF82" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M5 22h22" stroke="#D9BF82" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[16px] font-semibold tracking-tight text-ink">KarigarSetu</div>
          <div className="text-[11px] text-ink-3">Job-work & gold register</div>
        </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  new: 'neutral',
  assigned: 'info',
  gold_issued: 'gold',
  in_progress: 'gold',
  received: 'info',
  ready: 'ok',
  delivered: 'ok',
  cancelled: 'neutral',
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={cn(status === 'delivered' && 'opacity-80', className)}>
      {STATUS_SHORT[status]}
    </Badge>
  );
}

const RECON_TONE: Record<ReconStatus, Tone> = {
  no_gold: 'neutral',
  awaiting_return: 'gold',
  pending: 'warn',
  discrepancy: 'bad',
  completed: 'ok',
  completed_with_difference: 'warn',
};

export function ReconBadge({ status }: { status: ReconStatus }) {
  const Icon =
    status === 'discrepancy' ? AlertTriangle : status === 'completed' ? CheckCircle2 : status === 'awaiting_return' ? Hourglass : null;
  return (
    <Badge tone={RECON_TONE[status]}>
      {Icon && <Icon size={12} />}
      {RECON_LABEL[status]}
    </Badge>
  );
}

/** Per-purity gold amounts shown side by side — never summed across purities. */
export function PurityBalances({
  balances,
  empty = 'None',
  size = 'md',
  className,
}: {
  balances: Record<Purity, number>;
  empty?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const entries = Object.entries(balances);
  if (!entries.length) return <span className={cn('text-ink-3', size === 'sm' && 'text-sm', className)}>{empty}</span>;
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
      {entries.map(([purity, g]) => (
        <span key={purity} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={cn(
              'rounded-md bg-gold-50 px-1.5 font-semibold text-gold-700 ring-1 ring-inset ring-gold-200',
              size === 'lg' ? 'text-xs py-0.5' : 'text-[11px]',
            )}
          >
            {purity}
          </span>
          <span
            className={cn(
              'weight text-ink',
              size === 'lg' && 'text-[22px] font-semibold',
              size === 'md' && 'text-[15px] font-medium',
              size === 'sm' && 'text-sm',
              g < 0 && 'text-bad',
            )}
          >
            {formatGramsValue(g)}
            <span className={cn('ml-0.5 font-sans font-normal text-ink-3', size === 'lg' ? 'text-sm' : 'text-xs')}>g</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function Grams({ value, className, strong }: { value: number; className?: string; strong?: boolean }) {
  return <span className={cn('weight whitespace-nowrap', strong && 'font-semibold', className)}>{formatGrams(value)}</span>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-semibold text-ink-2 ring-1 ring-line', className)}
    >
      {initials(name)}
    </span>
  );
}

/** Delivery date with overdue / due-soon colouring. */
export function DueDate({ order, today, dueSoonDays, showRelative = true }: { order: Order; today: string; dueSoonDays: number; showRelative?: boolean }) {
  const open = isOpen(order);
  const diff = daysBetween(today, order.deliveryDate);
  const overdue = open && diff < 0;
  const soon = open && diff >= 0 && diff <= dueSoonDays;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={cn('whitespace-nowrap', overdue && 'font-medium text-bad', soon && 'font-medium text-warn')}>
        {formatDate(order.deliveryDate)}
      </span>
      {showRelative && open && (overdue || soon) && (
        <span className={cn('mt-0.5 inline-flex items-center gap-1 text-xs', overdue ? 'text-bad' : 'text-warn')}>
          <Clock size={11} />
          {overdue ? `Overdue · ${relativeDay(order.deliveryDate, today)}` : relativeDay(order.deliveryDate, today)}
        </span>
      )}
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="inline-flex items-center rounded-md bg-gold-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-700">
      Demo
    </span>
  );
}
