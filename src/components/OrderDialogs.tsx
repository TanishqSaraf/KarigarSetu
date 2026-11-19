import { AlertTriangle, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { karigarBalance, normalisePurity, orderGoldSummary, paymentSummary, reconcileTransactions, toMg, txnEffect } from '../lib/calculations';
import { addDays, formatDate } from '../lib/dates';
import { formatGrams, formatGramsValue, formatINR } from '../lib/format';
import { karigarJobStats, STATUS_LABEL, STATUS_ORDER, TXN_TYPE_LABEL } from '../lib/orders';
import type { GoldTransaction, Order, OrderStatus } from '../lib/types';
import { parseAmount, parseWeight } from '../lib/validation';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';
import { PurityBalances } from './domain';
import { ReconciliationMath } from './GoldMath';
import { KarigarDialog } from './KarigarDialog';
import { Button, Field, Input, Modal, MoneyInput, Segmented, Select, Textarea, WeightInput } from './ui';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  order: Order;
}

/** Reset local form state every time a dialog opens. */
function useOnOpen(open: boolean, reset: () => void) {
  useEffect(() => {
    if (open) reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Footer({ onClose, onSave, label, disabled }: { onClose: () => void; onSave: () => void; label: string; disabled?: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={disabled}>
        {label}
      </Button>
    </>
  );
}

// ---------- Assign karigar ----------

export function AssignDialog({ open, onClose, order }: DialogProps) {
  const { data, today, run } = useStore();
  const karigars = data.karigars.filter((k) => !k.archived);
  const [karigarId, setKarigarId] = useState('');
  const [assignedDate, setAssignedDate] = useState(today);
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);

  useOnOpen(open, () => {
    setKarigarId(order.assignment?.karigarId ?? karigars[0]?.id ?? '');
    setAssignedDate(order.assignment?.assignedDate ?? today);
    const suggested = addDays(order.deliveryDate, -2);
    setDue(order.assignment?.expectedCompletionDate ?? (suggested >= today ? suggested : order.deliveryDate < today ? today : order.deliveryDate));
    setNote('');
    setError(undefined);
  });

  const save = () => {
    if (!karigarId) return setError('Choose a karigar');
    if (!due) return setError('Choose when the karigar should finish');
    const ok = run(
      (d) => ops.assignKarigar(d, order.id, { karigarId, assignedDate, expectedCompletionDate: due, note }),
      `Assigned to ${data.karigars.find((k) => k.id === karigarId)?.name}`,
    );
    if (ok) onClose();
  };

  return (
    <>
      <Modal open={open && !adding} onClose={onClose} title={order.assignment ? 'Change karigar assignment' : 'Assign karigar'} subtitle={`${order.id} · ${order.customerName}`} footer={<Footer onClose={onClose} onSave={save} label="Save assignment" />}>
        <div className="space-y-4">
          {karigars.length === 0 ? (
            <div className="rounded-xl bg-sunken p-4 text-sm text-ink-2">You have not added any karigars yet.</div>
          ) : (
            <fieldset>
              <legend className="label">Karigar</legend>
              <div className="space-y-2" role="radiogroup">
                {karigars.map((k) => {
                  const s = karigarJobStats(k.id, data.orders);
                  const bal = karigarBalance(k.id, data.transactions);
                  const checked = karigarId === k.id;
                  return (
                    <label
                      key={k.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${checked ? 'border-ink bg-[#FCFAF6] ring-1 ring-ink' : 'border-line-strong hover:bg-sunken'}`}
                    >
                      <input type="radio" name="karigar" value={k.id} checked={checked} onChange={() => setKarigarId(k.id)} className="mt-1 accent-ink" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium">{k.name}</span>
                        <span className="block text-[13px] text-ink-3">
                          {k.specialisation || 'General work'} · {s.active + s.pending} active job{s.active + s.pending === 1 ? '' : 's'}
                        </span>
                        <PurityBalances balances={bal} size="sm" empty="No gold with them now" className="mt-1 text-[13px]" />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add a new karigar
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned on" htmlFor="as-date">
              <Input id="as-date" type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
            </Field>
            <Field label="Karigar to finish by" htmlFor="as-due">
              <Input id="as-due" type="date" value={due} min={assignedDate} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <p className="-mt-2 text-[13px] text-ink-3">Customer delivery date: {formatDate(order.deliveryDate)}</p>
          <Field label="Note" htmlFor="as-note" optional>
            <Input id="as-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Shared design photo on WhatsApp" />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </Modal>
      <KarigarDialog
        open={open && adding}
        onClose={() => setAdding(false)}
        onSaved={(id) => {
          setKarigarId(id);
          setAdding(false);
        }}
      />
    </>
  );
}

// ---------- Issue gold ----------

function PurityPicker({ value, onChange, extra = [] }: { value: string; onChange: (v: string) => void; extra?: string[] }) {
  const presets = Array.from(new Set(['22K', '18K', ...extra.map(normalisePurity)]));
  const isPreset = presets.includes(normalisePurity(value));
  const [other, setOther] = useState(!isPreset);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        name="Gold purity"
        value={other ? 'Other' : normalisePurity(value)}
        onChange={(v) => {
          if (v === 'Other') {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        options={[...presets.map((p) => ({ value: p, label: p })), { value: 'Other', label: 'Other' }]}
      />
      {other && <Input aria-label="Other purity" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 14K" className="w-28" />}
    </div>
  );
}

export function IssueGoldDialog({ open, onClose, order }: DialogProps) {
  const { data, today, run } = useStore();
  const karigar = data.karigars.find((k) => k.id === order.assignment?.karigarId);
  const [purity, setPurity] = useState(order.purity);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  useOnOpen(open, () => {
    setPurity(order.purity);
    setWeight('');
    setDate(today);
    setNotes('');
    setError(undefined);
  });

  const parsed = parseWeight(weight, { allowZero: false });
  const current = karigar ? karigarBalance(karigar.id, data.transactions) : {};
  const key = normalisePurity(purity || '—');
  const after = parsed.ok ? { ...current, [key]: (toMg(current[key] ?? 0) + toMg(parsed.value)) / 1000 } : null;

  const save = () => {
    if (!parsed.ok) return setError(parsed.error);
    if (!purity.trim()) return setError('Choose the gold purity');
    const ok = run((d) => ops.issueGold(d, order.id, { purity, weight: parsed.value, date, notes }).data, `${formatGrams(parsed.value)} of ${key} gold issued to ${karigar?.name}`);
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Issue gold to karigar" subtitle={`${order.id} · ${order.customerName}`} footer={<Footer onClose={onClose} onSave={save} label="Record gold issued" />}>
      <div className="space-y-4">
        <div className="rounded-xl bg-sunken px-4 py-3 text-sm">
          <div className="text-ink-3">Karigar</div>
          <div className="text-[15px] font-medium">{karigar?.name}</div>
        </div>
        <Field label="Gold purity">
          <PurityPicker value={purity} onChange={setPurity} extra={[order.purity]} />
        </Field>
        <Field
          label="Gold weight issued"
          htmlFor="ig-weight"
          error={weight && !parsed.ok ? parsed.error : error}
          hint={order.expectedWeight ? `Expected finished weight: ${formatGrams(order.expectedWeight)}. Issue a little extra to cover scrap and loss.` : 'Weigh on your scale, up to 3 decimals.'}
        >
          <WeightInput id="ig-weight" value={weight} onChange={(e) => { setWeight(e.target.value); setError(undefined); }} invalid={!!weight && !parsed.ok} className="text-lg" />
        </Field>
        <Field label="Date of issue" htmlFor="ig-date">
          <Input id="ig-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="ig-notes" optional>
          <Input id="ig-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Given as 2 bars" />
        </Field>
        {after && (
          <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm">
            <div className="text-ink-3">{karigar?.name} will hold</div>
            <PurityBalances balances={after} className="mt-1" />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------- Item received ----------

export function ReceiveDialog({ open, onClose, order }: DialogProps) {
  const { data, today, run } = useStore();
  const tol = data.settings.toleranceGrams;
  const karigar = data.karigars.find((k) => k.id === order.assignment?.karigarId);
  const orderTxns = useMemo(() => data.transactions.filter((t) => t.orderId === order.id), [data.transactions, order.id]);
  const current = useMemo(() => reconcileTransactions(orderTxns, tol), [orderTxns, tol]);
  const issuedPurities = current.filter((l) => l.issued > 0).map((l) => l.purity);
  const hasGold = issuedPurities.length > 0;

  const [purity, setPurity] = useState(issuedPurities[0] ?? order.purity);
  const [finished, setFinished] = useState('');
  const [scrap, setScrap] = useState('');
  const [loss, setLoss] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useOnOpen(open, () => {
    setPurity(issuedPurities[0] ?? order.purity);
    setFinished('');
    setScrap('');
    setLoss('');
    setDate(today);
    setNotes('');
    setSubmitted(false);
  });

  const pf = parseWeight(finished, { required: false });
  const ps = parseWeight(scrap, { required: false });
  const pl = parseWeight(loss, { required: false });
  const allOk = pf.ok && ps.ok && pl.ok;
  const anyEntered = allOk && pf.value + ps.value + pl.value > 0;

  // Live preview: existing entries for this purity + what is being entered now.
  const preview = useMemo(() => {
    if (!hasGold || !allOk) return null;
    const draft: GoldTransaction[] = [
      ...orderTxns,
      ...(
        [
          ['finished_return', pf.value],
          ['scrap_return', ps.value],
        ] as const
      )
        .filter(([, v]) => v > 0)
        .map(([type, weight], i) => ({ id: `draft-${i}`, date, karigarId: '', orderId: order.id, type, purity, weight, createdAt: '' })),
      ...(pl.value > 0 ? [{ id: 'draft-l', date, karigarId: '', orderId: order.id, type: 'adjustment' as const, reason: 'approved_loss' as const, direction: 'reduce' as const, purity, weight: pl.value, createdAt: '' }] : []),
    ];
    return reconcileTransactions(draft, tol).find((l) => l.purity === normalisePurity(purity)) ?? null;
  }, [hasGold, allOk, orderTxns, pf, ps, pl, date, order.id, purity, tol]);

  const previouslyReturned = current.find((l) => l.purity === normalisePurity(purity));
  const hadEarlierReturn = !!previouslyReturned?.hasReturn;

  const save = () => {
    setSubmitted(true);
    if (hasGold) {
      if (!allOk || !anyEntered) return;
      const ok = run(
        (d) => ops.receiveItem(d, order.id, { gold: { purity, finished: pf.value, scrap: ps.value, approvedLoss: pl.value }, date, notes }),
        'Return recorded — check the gold calculation',
      );
      if (ok) onClose();
    } else {
      const ok = run((d) => ops.receiveItem(d, order.id, { gold: null, date, notes }), 'Item marked as received');
      if (ok) onClose();
    }
  };

  const err = (p: ReturnType<typeof parseWeight>, raw: string) => (raw && !p.ok ? p.error : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={hadEarlierReturn ? 'Record more gold returned' : 'Record item received'}
      subtitle={`${order.id} · from ${karigar?.name ?? 'karigar'}`}
      footer={<Footer onClose={onClose} onSave={save} label={hasGold ? 'Save return' : 'Mark as received'} />}
    >
      {!hasGold ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-sunken px-4 py-3 text-sm text-ink-2">
            No shop gold was issued on this order, so there is nothing to weigh against. This just records that the item is back.
          </div>
          <Field label="Date received" htmlFor="rc-date">
            <Input id="rc-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="rc-notes" optional>
            <Input id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-4">
            {issuedPurities.length > 1 && (
              <Field label="Purity">
                <Segmented name="Purity" value={normalisePurity(purity)} onChange={setPurity} options={issuedPurities.map((p) => ({ value: p, label: p }))} />
              </Field>
            )}
            {hadEarlierReturn && (
              <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-[13px] text-info">
                A return was already recorded. Enter only the additional weight being returned now.
              </p>
            )}
            <Field label="Finished metal weight" htmlFor="rc-finished" hint="Weight of the finished piece, excluding stones." error={err(pf, finished)}>
              <WeightInput id="rc-finished" value={finished} onChange={(e) => setFinished(e.target.value)} invalid={!!err(pf, finished)} className="text-lg" />
            </Field>
            <Field label="Scrap gold returned" htmlFor="rc-scrap" hint="Filings, cut pieces and leftover gold handed back." error={err(ps, scrap)}>
              <WeightInput id="rc-scrap" value={scrap} onChange={(e) => setScrap(e.target.value)} invalid={!!err(ps, scrap)} />
            </Field>
            <Field
              label="Approved process loss"
              htmlFor="rc-loss"
              hint="Wastage you accept for this job (melting, polishing). Agreed by you, not fixed by the app."
              error={err(pl, loss)}
            >
              <WeightInput id="rc-loss" value={loss} onChange={(e) => setLoss(e.target.value)} invalid={!!err(pl, loss)} />
            </Field>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Date received" htmlFor="rc-date">
                <Input id="rc-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Notes" htmlFor="rc-notes" optional>
                <Input id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the karigar said" />
              </Field>
            </div>
            {submitted && allOk && !anyEntered && <p className="text-sm text-bad">Enter at least one weight that came back.</p>}
            {preview && anyEntered && (
              <div
                className={`sticky bottom-0 -mx-1 flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm shadow-card sm:hidden ${preview.exceedsTolerance ? 'border-bad-line bg-bad-bg text-bad' : 'border-line bg-surface text-ink'}`}
              >
                <span>{preview.unaccounted < 0 ? 'Extra returned' : 'Unaccounted'} (see below)</span>
                <span className="weight font-semibold">{formatGrams(Math.abs(preview.unaccounted))}</span>
              </div>
            )}
          </div>
          <div>
            <div className="eyebrow mb-2">Calculation</div>
            {preview ? (
              <ReconciliationMath line={preview} tolerance={tol} />
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-3">Fix the highlighted weights to see the calculation.</div>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
              Your entries are saved exactly as typed. If something doesn’t add up, the difference is shown — the app never adjusts a weight on its own.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Complete reconciliation ----------

export function ReconcileDialog({ open, onClose, order }: DialogProps) {
  const { data, today, run } = useStore();
  const tol = data.settings.toleranceGrams;
  const summary = orderGoldSummary(order, data.transactions, tol);
  const karigar = data.karigars.find((k) => k.id === order.assignment?.karigarId);
  const nonZero = summary.lines.filter((l) => toMg(l.unaccounted) !== 0);
  const over = summary.status === 'discrepancy';
  const [resolution, setResolution] = useState<'kept_with_karigar' | 'accepted_as_loss'>('accepted_as_loss');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useOnOpen(open, () => {
    setResolution(over ? 'kept_with_karigar' : 'accepted_as_loss');
    setNote('');
    setError(undefined);
  });

  const save = () => {
    if (over && !note.trim()) return setError('Add a note explaining the difference (e.g. what the karigar said).');
    const ok = run((d) => ops.completeReconciliation(d, order.id, { resolution, note, date: today }), 'Reconciliation completed');
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Complete gold reconciliation" subtitle={`${order.id} · ${karigar?.name ?? ''}`} footer={<Footer onClose={onClose} onSave={save} label="Complete reconciliation" />}>
      <div className="space-y-4">
        {summary.lines.map((l) => (
          <ReconciliationMath key={l.purity} line={l} tolerance={tol} compact />
        ))}
        {nonZero.length > 0 && (
          <fieldset>
            <legend className="label">What should happen to the {nonZero.map((l) => formatGrams(Math.abs(l.unaccounted))).join(' + ')} difference?</legend>
            <div className="space-y-2">
              {(
                [
                  ['kept_with_karigar', `Keep it in ${karigar?.name ?? 'the karigar'}'s balance`, 'They still owe this gold. It stays visible in their account until settled.'],
                  ['accepted_as_loss', 'Accept it as additional loss', 'Records a visible Adjustment entry in the ledger. Nothing is edited.'],
                ] as const
              ).map(([value, title, body]) => (
                <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 ${resolution === value ? 'border-ink ring-1 ring-ink' : 'border-line-strong'}`}>
                  <input type="radio" name="resolution" checked={resolution === value} onChange={() => setResolution(value)} className="mt-1 accent-ink" />
                  <span>
                    <span className="block text-[15px] font-medium">{title}</span>
                    <span className="block text-[13px] text-ink-3">{body}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {over && (
          <div className="flex gap-2 rounded-xl bg-bad-bg px-3.5 py-3 text-[13px] text-bad">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            The difference is above your tolerance. A note is required so you remember why it was closed.
          </div>
        )}
        <Field label="Note" htmlFor="rec-note" optional={!over} error={error}>
          <Textarea id="rec-note" value={note} onChange={(e) => { setNote(e.target.value); setError(undefined); }} className="min-h-[64px]" placeholder={over ? 'e.g. Karigar will return 0.6 g scrap on next visit' : 'e.g. Checked on shop scale'} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Status ----------

export function StatusDialog({ open, onClose, order }: DialogProps) {
  const { data, run } = useStore();
  const [status, setStatusValue] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState('');
  useOnOpen(open, () => {
    setStatusValue(order.status);
    setNote('');
  });
  const gold = orderGoldSummary(order, data.transactions, data.settings.toleranceGrams);
  const goldOpen = ['awaiting_return', 'pending', 'discrepancy'].includes(gold.status);
  const warn = goldOpen && (status === 'ready' || status === 'delivered');

  const save = () => {
    const ok = run((d) => ops.setStatus(d, order.id, status, note), `Status updated to “${STATUS_LABEL[status]}”`);
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Update status" subtitle={order.id} footer={<Footer onClose={onClose} onSave={save} label="Update status" disabled={status === order.status} />}>
      <div className="space-y-4">
        <Field label="Status" htmlFor="st-status">
          <Select id="st-status" value={status} onChange={(e) => setStatusValue(e.target.value as OrderStatus)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s} disabled={!order.assignment && ['assigned', 'gold_issued', 'in_progress', 'received'].includes(s)}>
                {STATUS_LABEL[s]}
                {s === order.status ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        {warn && (
          <div className="flex gap-2 rounded-xl bg-warn-bg px-3.5 py-3 text-[13px] text-warn">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            The gold for this order is not reconciled yet. You can still change the status, but the gold record will stay open.
          </div>
        )}
        <Field label="Note" htmlFor="st-note" optional>
          <Input id="st-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer informed by phone" />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Payment ----------

export function PaymentDialog({ open, onClose, order }: DialogProps) {
  const { today, run } = useStore();
  const remaining = paymentSummary(order).remaining;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  useOnOpen(open, () => {
    setAmount(remaining > 0 ? String(remaining) : '');
    setDate(today);
    setNote('');
    setError(undefined);
  });
  const save = () => {
    const p = parseAmount(amount, { required: true });
    if (!p.ok) return setError(p.error);
    if (p.value <= 0) return setError('Amount must be more than ₹0');
    const ok = run((d) => ops.recordPayment(d, order.id, { amount: p.value, date, note }), `${formatINR(p.value)} payment recorded`);
    if (ok) onClose();
  };
  const p = parseAmount(amount);
  return (
    <Modal open={open} onClose={onClose} title="Record payment received" subtitle={`${order.id} · remaining ${formatINR(remaining)}`} footer={<Footer onClose={onClose} onSave={save} label="Record payment" />}>
      <div className="space-y-4">
        <Field label="Amount received" htmlFor="pm-amount" error={error}>
          <MoneyInput id="pm-amount" value={amount} onChange={(e) => { setAmount(e.target.value); setError(undefined); }} invalid={!!error} className="text-lg" />
        </Field>
        {p.ok && p.value > remaining && remaining >= 0 && (
          <p className="-mt-2 text-[13px] text-warn">This is more than the remaining estimate of {formatINR(remaining)}. Update the order total if the bill changed.</p>
        )}
        <Field label="Date" htmlFor="pm-date">
          <Input id="pm-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="pm-note" optional>
          <Input id="pm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash / UPI" />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Notes ----------

export function NoteDialog({ open, onClose, order, eventId }: DialogProps & { eventId?: string }) {
  const { run } = useStore();
  const event = order.timeline.find((e) => e.id === eventId);
  const [note, setNote] = useState('');
  useOnOpen(open, () => {
    setNote(event?.note ?? '');
  });
  const save = () => {
    const ok = eventId
      ? run((d) => ops.editEventNote(d, order.id, eventId, note), 'Note saved')
      : run((d) => ops.addTimelineNote(d, order.id, note), 'Note added to timeline');
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={eventId ? (event?.note ? 'Edit note' : 'Add note to this event') : 'Add a note'} subtitle={event?.summary ?? order.id} footer={<Footer onClose={onClose} onSave={save} label="Save note" />}>
      <Textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer asked for a slightly thinner band" />
    </Modal>
  );
}

// ---------- Void a ledger entry ----------

export function VoidDialog({ open, onClose, txn }: { open: boolean; onClose: () => void; txn?: GoldTransaction }) {
  const { run } = useStore();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  useOnOpen(open, () => {
    setReason('');
    setError(undefined);
  });
  if (!txn) return null;
  const save = () => {
    if (!reason.trim()) return setError('Give a reason — it stays on record');
    const ok = run((d) => ops.voidTransaction(d, txn.id, reason), `${txn.id} voided`);
    if (ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Void entry ${txn.id}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep entry
          </Button>
          <Button variant="danger" onClick={save}>
            Void entry
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[15px] text-ink-2">
        <div className="rounded-xl bg-sunken px-4 py-3 text-sm">
          <div className="font-medium text-ink">{TXN_TYPE_LABEL[txn.type]}</div>
          <div className="weight mt-0.5">
            {formatGramsValue(txn.weight)} g {txn.purity} · effect {txnEffect(txn) > 0 ? '+' : ''}
            {formatGramsValue(txnEffect(txn))} g · {formatDate(txn.date)}
          </div>
        </div>
        <p>
          Use this only for a mistaken entry. The entry stays in the ledger, crossed out with your reason, and stops counting in balances. Then record the correct entry.
        </p>
        <Field label="Reason" htmlFor="void-reason" error={error}>
          <Input id="void-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} placeholder="e.g. Typing mistake — should be 16.500 g" />
        </Field>
      </div>
    </Modal>
  );
}
