import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock4, Hourglass, PackageCheck, Plus, Scale, ScrollText, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, PurityBalances } from '../components/domain';
import { OrderList } from '../components/OrderList';
import { ButtonLink, Card, CardHeader, EmptyState, InfoTip } from '../components/ui';
import { allKarigarBalances, orderGoldSummary, totalOutstanding } from '../lib/calculations';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dates';
import { formatGrams } from '../lib/format';
import { attentionItems, isDueSoon, isOpen, isOverdue, karigarJobStats, type AttentionKind } from '../lib/orders';
import { useStore } from '../store/StoreProvider';

function Stat({
  to,
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  className,
  tip,
}: {
  to: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: 'neutral' | 'warn' | 'bad' | 'gold';
  className?: string;
  tip?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'card group flex flex-col justify-between p-4 transition-colors hover:border-line-strong sm:p-5',
        tone === 'bad' && 'border-bad-line bg-[#FFFBFA]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[13px] font-medium text-ink-3">
          {label}
          {tip && <InfoTip>{tip}</InfoTip>}
        </span>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            tone === 'neutral' && 'bg-sunken text-ink-3',
            tone === 'warn' && 'bg-warn-bg text-warn',
            tone === 'bad' && 'bg-bad-bg text-bad',
            tone === 'gold' && 'bg-gold-50 text-gold-600',
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3">
        <div className={cn('num text-[28px] font-semibold leading-none tracking-tight', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>
          {value}
        </div>
        {sub && <div className="mt-1.5 text-[13px] text-ink-3">{sub}</div>}
      </div>
    </Link>
  );
}

const ATTENTION_ICON: Record<AttentionKind, ReactNode> = {
  discrepancy: <Scale size={16} />,
  overdue: <Clock4 size={16} />,
  ready_not_delivered: <PackageCheck size={16} />,
  stale: <Hourglass size={16} />,
  reconcile: <CheckCircle2 size={16} />,
};

export default function Dashboard() {
  const { data, today } = useStore();
  const { orders, karigars, transactions, settings } = data;
  const tol = settings.toleranceGrams;

  const active = orders.filter(isOpen);
  const overdue = orders.filter((o) => isOverdue(o, today));
  const dueSoon = orders.filter((o) => isDueSoon(o, today, settings.dueSoonDays));
  const recon = orders.map((o) => orderGoldSummary(o, transactions, tol).status);
  const pendingRecon = recon.filter((s) => s === 'pending' || s === 'discrepancy').length;
  const discrepancies = recon.filter((s) => s === 'discrepancy').length;
  const outstanding = totalOutstanding(transactions);
  const balances = allKarigarBalances(transactions);
  const attention = attentionItems(data, today);
  const recent = [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const activeKarigars = karigars.filter((k) => !k.archived);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
        <div>
          <p className="text-sm text-ink-3">{formatDate(today)}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight sm:text-[26px]">
            {settings.ownerName ? `Namaste, ${settings.ownerName.split(' ')[0]}` : settings.shopName}
          </h1>
        </div>
        <ButtonLink to="/orders/new" size="lg" className="hidden sm:inline-flex">
          <Plus size={19} /> New Order
        </ButtonLink>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        <Stat to="/orders?status=open" label="Active orders" value={active.length} sub="Not yet delivered" icon={<ScrollText size={16} />} className="lg:col-span-1" />
        <Stat
          to="/orders?due=week&status=open"
          label="Due soon"
          value={dueSoon.length}
          sub={`Within ${settings.dueSoonDays} days`}
          icon={<CalendarClock size={16} />}
          tone={dueSoon.length ? 'warn' : 'neutral'}
        />
        <Stat
          to="/orders?due=overdue"
          label="Overdue"
          value={overdue.length}
          sub="Delivery date passed"
          icon={<AlertTriangle size={16} />}
          tone={overdue.length ? 'bad' : 'neutral'}
        />
        <Stat
          to="/ledger"
          label="Gold with karigars"
          value={<PurityBalances balances={outstanding} size="lg" empty="0.000 g" />}
          sub="Shown separately for each purity"
          icon={<Scale size={16} />}
          tone="gold"
          className="order-last col-span-2 lg:order-none"
          tip="Gold issued to karigars, minus finished metal, scrap and approved loss already accounted for. Different purities are never added together."
        />
        <Stat
          to="/orders?recon=attention"
          label="Pending reconciliation"
          value={pendingRecon}
          sub={discrepancies ? <span className="font-medium text-bad">{discrepancies} with a difference</span> : 'Items back, gold not yet closed'}
          icon={<CheckCircle2 size={16} />}
          tone={discrepancies ? 'bad' : pendingRecon ? 'warn' : 'neutral'}
        />
      </div>

      <div className="mt-5 grid gap-5 sm:mt-6 lg:grid-cols-3">
        <div className="contents lg:order-2 lg:block lg:space-y-5">
        {/* Attention */}
        <Card className="order-1 lg:order-none">
          <CardHeader
            title="Attention required"
            subtitle={attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'}` : undefined}
            icon={<AlertTriangle size={17} />}
          />
          {attention.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={20} />} title="All clear" body="No overdue orders, gold differences or stalled jobs." />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {attention.map((a) => (
                <li key={`${a.kind}-${a.orderId}`}>
                  <Link to={`/orders/${a.orderId}`} className="flex gap-3 px-4 py-3 hover:bg-[#FCFAF6] sm:px-5">
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        a.severity === 'high' && 'bg-bad-bg text-bad',
                        a.severity === 'medium' && 'bg-warn-bg text-warn',
                        a.severity === 'low' && 'bg-sunken text-ink-3',
                      )}
                    >
                      {ATTENTION_ICON[a.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{a.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Karigar overview */}
        <Card className="order-3 lg:order-none">
          <CardHeader
            title="Karigar overview"
            icon={<Users size={17} />}
            action={
              <Link to="/karigars" className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 hover:text-ink">
                Manage <ArrowRight size={15} />
              </Link>
            }
          />
          {activeKarigars.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="No karigars yet" body="Add the goldsmiths you give work to." />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {activeKarigars.map((k) => {
                const s = karigarJobStats(k.id, orders);
                return (
                  <li key={k.id}>
                    <Link to={`/karigars/${k.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FCFAF6] sm:px-5">
                      <Avatar name={k.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{k.name}</span>
                          <span className="shrink-0 text-xs text-ink-3">
                            {s.active + s.pending} active job{s.active + s.pending === 1 ? '' : 's'}
                          </span>
                        </div>
                        <PurityBalances balances={balances.get(k.id) ?? {}} size="sm" empty="No gold with karigar" className="mt-1" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-3 sm:px-5">
            Tolerance for flagging differences: <span className="weight">{formatGrams(tol)}</span> ·{' '}
            <Link to="/settings" className="underline underline-offset-2">
              change
            </Link>
          </p>
        </Card>
        </div>
        {/* Recent orders */}
        <Card className="order-2 self-start overflow-hidden lg:order-1 lg:col-span-2">
          <CardHeader
            title="Recent orders"
            subtitle="Latest activity first"
            icon={<ScrollText size={17} />}
            action={
              <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 hover:text-ink">
                All orders <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="mt-3">
            {recent.length ? (
              <OrderList orders={recent} data={data} today={today} />
            ) : (
              <EmptyState
                icon={<ScrollText size={20} />}
                title="No orders yet"
                body="Create your first customer order to start tracking it."
                action={
                  <ButtonLink to="/orders/new">
                    <Plus size={17} /> New Order
                  </ButtonLink>
                }
              />
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
