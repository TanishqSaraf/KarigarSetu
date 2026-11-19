import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  IndianRupee,
  MessageSquarePlus,
  Pencil,
  Phone,
  Scale,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, DueDate, Grams, PurityBalances, ReconBadge, StatusBadge } from '../components/domain';
import { RECON_EXPLAINER, ReconciliationMath } from '../components/GoldMath';
import {
  AssignDialog,
  IssueGoldDialog,
  NoteDialog,
  PaymentDialog,
  ReceiveDialog,
  ReconcileDialog,
  StatusDialog,
  VoidDialog,
} from '../components/OrderDialogs';
import { Badge, Button, ButtonLink, Card, CardHeader, InfoTip, KeyValue } from '../components/ui';
import { compareTxns, orderGoldSummary, paymentSummary, txnEffect, type OrderGoldSummary } from '../lib/calculations';
import { cn } from '../lib/cn';
import { daysBetween, formatDate, formatDateTime } from '../lib/dates';
import { adjustmentDetail } from '../lib/csv';
import { formatGrams, formatINR, formatPhone, formatSignedGrams } from '../lib/format';
import { isOverdue, itemLabel, itemTitle, TXN_TYPE_LABEL, WITH_KARIGAR } from '../lib/orders';
import type { GoldTransaction, Order, TimelineEventType } from '../lib/types';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';
import NotFound from './NotFound';

type DialogKey = 'assign' | 'issue' | 'receive' | 'reconcile' | 'status' | 'payment' | 'note' | null;

const STEPS: Array<{ key: string; label: string }> = [
  { key: 'created', label: 'Order taken' },
  { key: 'assigned', label: 'Karigar assigned' },
  { key: 'gold_issued', label: 'Gold issued' },
  { key: 'work_started', label: 'Work started' },
  { key: 'item_received', label: 'Item received' },
  { key: 'reconciled', label: 'Gold reconciled' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
];

function completedSteps(order: Order, gold: OrderGoldSummary): Set<string> {
  const done = new Set<string>(['created']);
  const s = order.status;
  const rank = ['new', 'assigned', 'gold_issued', 'in_progress', 'received', 'ready', 'delivered'].indexOf(s);
  if (order.assignment) done.add('assigned');
  if (gold.lines.some((l) => l.issued > 0)) done.add('gold_issued');
  if (rank >= 3 || order.timeline.some((e) => e.type === 'work_started')) done.add('work_started');
  if (rank >= 4) done.add('item_received');
  if (order.reconciliation) done.add('reconciled');
  if (rank >= 5) done.add('ready');
  if (s === 'delivered') done.add('delivered');
  return done;
}

function Progress({ order, gold }: { order: Order; gold: OrderGoldSummary }) {
  const done = completedSteps(order, gold);
  const current = STEPS.findIndex((st) => !done.has(st.key));
  return (
    <ol className="flex items-start" aria-label="Order progress">
      {STEPS.map((st, i) => {
        const isDone = done.has(st.key);
        const isCurrent = i === current && order.status !== 'cancelled';
        return (
          <li key={st.key} className="flex flex-1 flex-col items-center text-center" aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : isDone || isCurrent ? 'bg-gold-300' : 'bg-line')} />
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                  isDone && 'border-gold-500 bg-gold-500 text-white',
                  isCurrent && 'border-ink bg-surface text-ink ring-4 ring-gold-100',
                  !isDone && !isCurrent && 'border-line-strong bg-surface text-ink-4',
                )}
              >
                {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === STEPS.length - 1 ? 'bg-transparent' : done.has(STEPS[i + 1]!.key) || i + 1 === current ? 'bg-gold-300' : 'bg-line')} />
            </div>
            <span className={cn('mt-1.5 hidden px-0.5 text-[11px] leading-tight sm:block', isCurrent ? 'font-semibold text-ink' : isDone ? 'text-ink-2' : 'text-ink-4')}>
              {st.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface NextStep {
  title: string;
  body: string;
  primary?: { label: string; onClick: () => void; icon?: ReactNode };
  secondary?: { label: string; onClick: () => void };
  tone?: 'bad' | 'ok' | 'neutral';
}

export default function OrderDetail() {
  const { id } = useParams();
  const { data, today, run } = useStore();
  const [dialog, setDialog] = useState<DialogKey>(null);
  const [noteEvent, setNoteEvent] = useState<string | undefined>();
  const [voiding, setVoiding] = useState<GoldTransaction | undefined>();
  const order = data.orders.find((o) => o.id === id);
  if (!order) return <NotFound />;

  const tol = data.settings.toleranceGrams;
  const gold = orderGoldSummary(order, data.transactions, tol);
  const karigar = data.karigars.find((k) => k.id === order.assignment?.karigarId);
  const txns = data.transactions.filter((t) => t.orderId === order.id).sort(compareTxns);
  const pay = paymentSummary(order);
  const overdue = isOverdue(order, today);
  const close = () => setDialog(null);
  const open = (k: DialogKey) => () => setDialog(k);
  const closed = order.status === 'delivered' || order.status === 'cancelled';
  const hasIssued = gold.lines.some((l) => l.issued > 0);

  // What the owner most likely needs to do next.
  const next: NextStep | null = (() => {
    const s = order.status;
    if (s === 'cancelled') return { title: 'Order cancelled', body: hasIssued && gold.status !== 'completed' ? 'Gold issued for this order is still on the karigar’s balance until it is returned.' : 'No further action needed.', tone: 'neutral' };
    if (gold.status === 'discrepancy')
      return {
        title: `${formatGrams(Math.abs(gold.worstUnaccounted))} of gold doesn’t add up`,
        body: `This is more than your ${formatGrams(tol)} tolerance. Ask ${karigar?.name ?? 'the karigar'} about it. If they bring more scrap, record it as another return; otherwise close it with a note.`,
        primary: { label: 'Review & reconcile', onClick: open('reconcile'), icon: <Scale size={17} /> },
        secondary: { label: 'Record more returned', onClick: open('receive') },
        tone: 'bad',
      };
    if (s === 'new') return { title: 'Assign a karigar', body: 'Choose who will make this piece and when they should finish.', primary: { label: 'Assign karigar', onClick: open('assign'), icon: <UserRound size={17} /> } };
    if (s === 'assigned')
      return {
        title: `Issue gold to ${karigar?.name}`,
        body: 'Weigh the gold you are handing over and record it here.',
        primary: { label: 'Issue gold', onClick: open('issue'), icon: <Scale size={17} /> },
        secondary: { label: order.orderType === 'Repair' ? 'Start without issuing gold' : 'Mark work started', onClick: () => run((d) => ops.markWorkStarted(d, order.id), 'Marked as work started') },
      };
    if (s === 'gold_issued')
      return {
        title: 'Waiting for karigar to start',
        body: `Gold is with ${karigar?.name}. Mark when work begins, or record the item when it comes back.`,
        primary: { label: 'Mark work started', onClick: () => run((d) => ops.markWorkStarted(d, order.id), 'Marked as work started'), icon: <CircleDot size={17} /> },
        secondary: { label: 'Item received', onClick: open('receive') },
      };
    if (s === 'in_progress')
      return {
        title: `With ${karigar?.name}`,
        body: order.assignment ? `Expected back by ${formatDate(order.assignment.expectedCompletionDate)}. When the piece comes back, weigh it without stones and record the return.` : '',
        primary: { label: 'Record item received', onClick: open('receive'), icon: <Scale size={17} /> },
      };
    if (s === 'received' && (gold.status === 'pending' || gold.status === 'awaiting_return'))
      return gold.status === 'pending'
        ? { title: 'Confirm the gold reconciliation', body: 'The difference is within your tolerance. Confirm to close the gold record for this order.', primary: { label: 'Complete reconciliation', onClick: open('reconcile'), icon: <CheckCircle2 size={17} /> } }
        : { title: 'Record the gold returned', body: 'The item is back but no gold return was recorded.', primary: { label: 'Record return', onClick: open('receive'), icon: <Scale size={17} /> } };
    if (s === 'received')
      return {
        title: 'Mark ready for delivery',
        body: 'Once quality is checked, mark it ready and inform the customer.',
        primary: { label: 'Mark ready', onClick: () => run((d) => ops.setStatus(d, order.id, 'ready'), 'Marked ready for delivery'), icon: <CheckCircle2 size={17} /> },
      };
    if (s === 'ready')
      return {
        title: 'Ready — waiting for customer',
        body: pay.remaining > 0 ? `${formatINR(pay.remaining)} is still to be collected on delivery.` : 'Payment is complete.',
        primary: { label: 'Mark delivered', onClick: () => run((d) => ops.setStatus(d, order.id, 'delivered'), `${order.id} delivered`), icon: <Check size={17} /> },
        secondary: pay.remaining > 0 ? { label: 'Record payment', onClick: open('payment') } : undefined,
        tone: 'ok',
      };
    if (s === 'delivered') return { title: 'Delivered', body: pay.remaining > 0 ? `${formatINR(pay.remaining)} still due from the customer.` : 'This order is complete.', tone: 'ok', secondary: pay.remaining > 0 ? { label: 'Record payment', onClick: open('payment') } : undefined };
    return null;
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <Link to="/orders" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft size={16} /> Orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-medium text-ink-3">{order.id}</span>
              <StatusBadge status={order.status} />
              {overdue && (
                <Badge tone="bad">
                  <AlertTriangle size={12} /> Overdue by {daysBetween(order.deliveryDate, today)} day{daysBetween(order.deliveryDate, today) === 1 ? '' : 's'}
                </Badge>
              )}
              {gold.status !== 'no_gold' && <ReconBadge status={gold.status} />}
            </div>
            <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight sm:text-[26px]">{order.customerName}</h1>
            <p className="mt-0.5 text-[15px] text-ink-3">
              {itemTitle(order)} · {order.metalType} · due {formatDate(order.deliveryDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink to={`/orders/${order.id}/edit`} variant="secondary" size="sm">
              <Pencil size={14} /> Edit
            </ButtonLink>
            <Button variant="secondary" size="sm" onClick={open('status')}>
              Update status
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-5 px-3 py-4 sm:px-5">
        <Progress order={order} gold={gold} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Next step */}
          {next && (
            <div
              className={cn(
                'rounded-2xl border p-4 sm:p-5',
                next.tone === 'bad' ? 'border-bad-line bg-bad-bg' : next.tone === 'ok' ? 'border-ok-line bg-ok-bg' : 'border-gold-200 bg-gold-50',
              )}
              data-testid="next-step"
            >
              <div className="eyebrow">{closed ? 'Status' : 'Next step'}</div>
              <h2 className={cn('mt-1 text-lg font-semibold', next.tone === 'bad' && 'text-bad')}>{next.title}</h2>
              <p className="mt-1 text-[15px] text-ink-2">{next.body}</p>
              {(next.primary || next.secondary) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {next.primary && (
                    <Button size="lg" onClick={next.primary.onClick} variant={next.tone === 'bad' ? 'danger' : 'primary'}>
                      {next.primary.icon} {next.primary.label}
                    </Button>
                  )}
                  {next.secondary && (
                    <Button size="lg" variant="secondary" onClick={next.secondary.onClick}>
                      {next.secondary.label}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Karigar assignment */}
          <Card>
            <CardHeader
              title="Karigar"
              icon={<UserRound size={17} />}
              action={
                !closed && (
                  <Button variant="ghost" size="sm" onClick={open('assign')}>
                    {order.assignment ? 'Change' : 'Assign'}
                  </Button>
                )
              }
            />
            <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              {karigar && order.assignment ? (
                <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                  <Link to={`/karigars/${karigar.id}`} className="flex items-center gap-3 hover:opacity-80">
                    <Avatar name={karigar.name} className="h-11 w-11" />
                    <div>
                      <div className="text-[15px] font-medium">{karigar.name}</div>
                      <div className="text-[13px] text-ink-3">{karigar.specialisation}</div>
                    </div>
                  </Link>
                  <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
                    <KeyValue label="Assigned on" value={formatDate(order.assignment.assignedDate)} />
                    <KeyValue
                      label="To finish by"
                      value={
                        <span className={cn(WITH_KARIGAR.includes(order.status) && order.assignment.expectedCompletionDate < today && 'font-medium text-bad')}>
                          {formatDate(order.assignment.expectedCompletionDate)}
                        </span>
                      }
                    />
                    {karigar.phone && (
                      <KeyValue
                        label="Phone"
                        value={
                          <a href={`tel:${karigar.phone}`} className="inline-flex items-center gap-1 text-gold-700 underline-offset-2 hover:underline">
                            <Phone size={13} /> {formatPhone(karigar.phone)}
                          </a>
                        }
                      />
                    )}
                  </dl>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4">
                  <span className="text-sm text-ink-3">No karigar assigned yet.</span>
                  {!closed && (
                    <Button size="sm" onClick={open('assign')}>
                      Assign karigar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Gold record */}
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-1.5">
                  Gold record <InfoTip label="How reconciliation works">{RECON_EXPLAINER}</InfoTip>
                </span>
              }
              subtitle="Every weight given to and received from the karigar for this order"
              icon={<Scale size={17} />}
            />
            <div className="space-y-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
              {gold.status === 'no_gold' ? (
                <div className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-3">
                  No gold issued yet.
                  {order.assignment && !closed && (
                    <div className="mt-3">
                      <Button size="sm" onClick={open('issue')}>
                        Issue gold
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {gold.lines.map((l) =>
                      gold.status === 'awaiting_return' ? (
                        <div key={l.purity} className="rounded-xl border border-line bg-[#FCFAF6] px-4 py-3">
                          <div className="text-[13px] text-ink-3">Issued, awaiting return</div>
                          <PurityBalances balances={{ [l.purity]: l.issued }} size="lg" className="mt-1" />
                          <p className="mt-2 text-[13px] text-ink-3">The calculation appears once the karigar returns the item.</p>
                        </div>
                      ) : (
                        <ReconciliationMath key={l.purity} line={l} tolerance={tol} />
                      ),
                    )}
                    {gold.lines.length === 1 && gold.status !== 'awaiting_return' && (
                      <div className="rounded-xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
                        <div className="mb-1 font-medium text-ink">How to read this</div>
                        Everything handed to the karigar should come back as finished metal, scrap, or loss you have approved. What’s left is{' '}
                        <strong className="font-medium">unaccounted</strong> — it stays on {karigar?.name ?? 'the karigar'}’s balance until it is
                        returned or you accept it.
                        <div className="mt-2 text-ink-3">Your tolerance: {formatGrams(tol)} (change in Settings). Recorded weights are never altered.</div>
                      </div>
                    )}
                    {gold.lines.length === 1 && gold.status === 'awaiting_return' && karigar && (
                      <div className="rounded-xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
                        When {karigar.name.split(' ')[0]} brings the piece back, weigh it <strong className="font-medium">without stones</strong>, weigh any scrap,
                        and agree the process loss. The app will work out the difference.
                      </div>
                    )}
                  </div>
                  {order.reconciliation && (
                    <div className="flex gap-2 rounded-xl bg-ok-bg px-3.5 py-3 text-sm text-ok">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium">
                          Reconciled on {formatDate(order.reconciliation.completedAt)}
                          {order.reconciliation.resolution === 'accepted_as_loss' && ' — difference accepted as loss'}
                          {order.reconciliation.resolution === 'kept_with_karigar' && ' — difference kept on karigar’s balance'}
                        </div>
                        {order.reconciliation.note && <div className="mt-0.5 text-ink-2">“{order.reconciliation.note}”</div>}
                      </div>
                    </div>
                  )}
                  {!closed && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={open('issue')}>
                        Issue more gold
                      </Button>
                      <Button variant="secondary" size="sm" onClick={open('receive')}>
                        {gold.lines.some((l) => l.hasReturn) ? 'Record more returned' : 'Record item received'}
                      </Button>
                      {(gold.status === 'pending' || gold.status === 'discrepancy') && (
                        <Button size="sm" onClick={open('reconcile')}>
                          Complete reconciliation
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {txns.length > 0 && (
                <div>
                  <div className="eyebrow mb-2">Ledger entries</div>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {txns.map((t) => (
                      <li key={t.id} className={cn('flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm', t.voided && 'bg-sunken/60')}>
                        <div className={cn('min-w-0', t.voided && 'text-ink-4 line-through')}>
                          <div className="font-medium text-ink-2">
                            {TXN_TYPE_LABEL[t.type]}
                            {t.type === 'adjustment' && <span className="font-normal text-ink-3"> · {adjustmentDetail(t).replace(/ \(.*\)$/, '')}</span>}
                          </div>
                          <div className="text-[13px] text-ink-3">
                            <span className="num">{t.id}</span> · {formatDate(t.date)}
                            {t.notes && ` · ${t.notes}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          <div className="text-right">
                            <div className={cn('weight', t.voided ? 'text-ink-4 line-through' : txnEffect(t) > 0 ? 'text-ink' : 'text-ok')}>
                              {formatSignedGrams(t.voided ? (t.type === 'issue' ? t.weight : -t.weight) : txnEffect(t))}
                            </div>
                            <div className="text-[11px] text-ink-4">{t.purity}</div>
                          </div>
                          {!t.voided && (
                            <button onClick={() => setVoiding(t)} className="rounded-md p-1 text-ink-4 hover:bg-sunken hover:text-bad" aria-label={`Void ${t.id}`} title="Void this entry">
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                        {t.voided && <div className="sr-only">Voided: {t.voided.reason}</div>}
                      </li>
                    ))}
                  </ul>
                  {txns.some((t) => t.voided) && <p className="mt-1.5 text-xs text-ink-4">Crossed-out entries were voided and are not counted.</p>}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Order details" icon={<StickyNote size={17} />} />
            <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              {order.designImage && (
                <a href={order.designImage} target="_blank" rel="noreferrer" className="mb-4 block overflow-hidden rounded-xl border border-line">
                  <img src={order.designImage} alt={`Design for ${order.id}`} className="max-h-64 w-full object-cover" />
                </a>
              )}
              {order.description && <p className="mb-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{order.description}</p>}
              <dl className="grid grid-cols-2 gap-4">
                <KeyValue label="Customer" value={order.customerName} />
                <KeyValue
                  label="Phone"
                  value={
                    order.customerPhone ? (
                      <a href={`tel:${order.customerPhone}`} className="text-gold-700 hover:underline">
                        {formatPhone(order.customerPhone)}
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
                <KeyValue label="Type" value={order.orderType} />
                <KeyValue label="Item" value={itemLabel(order)} />
                <KeyValue label="Metal · Purity" value={`${order.metalType} · ${order.purity}`} />
                <KeyValue label="Expected weight" value={order.expectedWeight ? <Grams value={order.expectedWeight} /> : '—'} />
                <KeyValue label="Order date" value={formatDate(order.orderDate)} />
                <KeyValue label="Delivery date" value={<DueDate order={order} today={today} dueSoonDays={data.settings.dueSoonDays} />} />
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payment"
              subtitle="Rupees — separate from gold weights"
              icon={<IndianRupee size={17} />}
              action={
                order.status !== 'cancelled' && (
                  <Button variant="ghost" size="sm" onClick={open('payment')}>
                    Record payment
                  </Button>
                )
              }
            />
            <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <dl className="space-y-2 text-[15px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Making charges (est.)</dt>
                  <dd className="num">{formatINR(order.makingCharges)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Total estimated amount</dt>
                  <dd className="num font-medium">{formatINR(pay.estimatedTotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Advance received</dt>
                  <dd className="num">− {formatINR(pay.advance)}</dd>
                </div>
                {order.payments.map((p) => (
                  <div key={p.id} className="flex justify-between gap-3">
                    <dt className="text-ink-3">
                      Paid {formatDate(p.date)}
                      {p.note && <span className="text-ink-4"> · {p.note}</span>}
                    </dt>
                    <dd className="num">− {formatINR(p.amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-line pt-2.5">
                  <dt className="font-medium">{pay.remaining < 0 ? 'Paid in excess' : 'Remaining'}</dt>
                  <dd className={cn('num text-lg font-semibold', pay.remaining > 0 ? 'text-ink' : 'text-ok')}>{formatINR(Math.abs(pay.remaining))}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Timeline"
              icon={<CalendarDays size={17} />}
              action={
                <Button variant="ghost" size="sm" onClick={() => { setNoteEvent(undefined); setDialog('note'); }}>
                  <MessageSquarePlus size={15} /> Add note
                </Button>
              }
            />
            <Timeline order={order} onNote={(eid) => { setNoteEvent(eid); setDialog('note'); }} />
          </Card>
        </div>
      </div>

      <AssignDialog open={dialog === 'assign'} onClose={close} order={order} />
      <IssueGoldDialog open={dialog === 'issue'} onClose={close} order={order} />
      <ReceiveDialog open={dialog === 'receive'} onClose={close} order={order} />
      <ReconcileDialog open={dialog === 'reconcile'} onClose={close} order={order} />
      <StatusDialog open={dialog === 'status'} onClose={close} order={order} />
      <PaymentDialog open={dialog === 'payment'} onClose={close} order={order} />
      <NoteDialog open={dialog === 'note'} onClose={close} order={order} eventId={noteEvent} />
      <VoidDialog open={!!voiding} onClose={() => setVoiding(undefined)} txn={voiding} />
    </div>
  );
}

const EVENT_DOT: Partial<Record<TimelineEventType, string>> = {
  created: 'bg-ink-3',
  assigned: 'bg-info',
  gold_issued: 'bg-gold-500',
  work_started: 'bg-gold-500',
  item_received: 'bg-info',
  reconciled: 'bg-ok',
  ready: 'bg-ok',
  delivered: 'bg-ok',
  cancelled: 'bg-bad',
  entry_voided: 'bg-bad',
  payment: 'bg-ok',
};

function Timeline({ order, onNote }: { order: Order; onNote: (eventId: string) => void }) {
  const events = [...order.timeline].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
          <span className={cn('relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-surface', EVENT_DOT[e.type] ?? 'bg-line-strong')} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{e.summary}</div>
            <div className="text-xs text-ink-3">{formatDateTime(e.at)}</div>
            {e.note && <div className="mt-1.5 rounded-lg bg-sunken px-2.5 py-1.5 text-[13px] text-ink-2">{e.note}</div>}
            <button onClick={() => onNote(e.id)} className="mt-1 text-xs font-medium text-ink-3 hover:text-gold-700">
              {e.note ? 'Edit note' : 'Add note'}
            </button>
          </div>
        </li>
      ))}
      {events.length === 0 && (
        <li className="text-sm text-ink-3">
          No events yet. <ArrowRight size={12} className="inline" />
        </li>
      )}
    </ol>
  );
}
