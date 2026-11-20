import { BookOpenText, Download, Plus, Scale, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar } from '../components/domain';
import { LedgerTable, ReconLegend, TXN_RECON_LABEL, txnReconState } from '../components/LedgerTable';
import { VoidDialog } from '../components/OrderDialogs';
import { Button, Card, CardHeader, EmptyState, Field, InfoTip, Input, Modal, PageHeader, Segmented, Select, Textarea, WeightInput } from '../components/ui';
import { allKarigarBalances, compareTxns, normalisePurity, totalOutstanding } from '../lib/calculations';
import { cn } from '../lib/cn';
import { downloadText, ledgerToCSV } from '../lib/csv';
import { formatGramsValue } from '../lib/format';
import { TXN_TYPE_LABEL } from '../lib/orders';
import type { AdjustmentDirection, GoldTransaction, GoldTxnType } from '../lib/types';
import { parseWeight } from '../lib/validation';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';

export default function Ledger() {
  const { data, today, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [adjusting, setAdjusting] = useState(false);
  const [voiding, setVoiding] = useState<GoldTransaction>();

  const f = {
    q: params.get('q') ?? '',
    karigar: params.get('karigar') ?? 'all',
    type: (params.get('type') as GoldTxnType | 'all') ?? 'all',
    purity: params.get('purity') ?? 'all',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    open: params.get('open') === '1',
  };
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const purities = Array.from(new Set(data.transactions.map((t) => normalisePurity(t.purity)))).sort();
  const outstanding = totalOutstanding(data.transactions);
  const balances = allKarigarBalances(data.transactions);
  const balancePurities = Array.from(new Set([...balances.values()].flatMap((b) => Object.keys(b)))).sort();
  const karigarRows = data.karigars.filter((k) => !k.archived || Object.keys(balances.get(k.id) ?? {}).length);

  const q = f.q.trim().toLowerCase();
  const filtered = data.transactions
    .filter((t) => {
      if (f.karigar !== 'all' && t.karigarId !== f.karigar) return false;
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.purity !== 'all' && normalisePurity(t.purity) !== f.purity) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.open) {
        const s = txnReconState(t, data);
        if (t.voided || (s !== 'open' && s !== 'difference')) return false;
      }
      if (q) {
        const name = data.karigars.find((k) => k.id === t.karigarId)?.name ?? '';
        if (![t.id, t.orderId ?? '', name, t.notes ?? '', TXN_TYPE_LABEL[t.type]].join(' ').toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => compareTxns(b, a));

  const anyFilter = [...params.keys()].length > 0;
  const unreconciledCount = data.transactions.filter((t) => !t.voided && ['open', 'difference'].includes(txnReconState(t, data))).length;

  const exportCSV = async () => {
    if (!filtered.length) return toast('error', 'Nothing to export — no entries match the filters');
    const csv = ledgerToCSV([...filtered].sort(compareTxns), data.karigars, (t) => TXN_RECON_LABEL[txnReconState(t, data)]);
    const slug = data.settings.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop';
    const outcome = await downloadText(`${slug}-gold-ledger-${today}.csv`, csv, 'text/csv;charset=utf-8');
    if (outcome === 'saved') toast('success', `Exported ${filtered.length} ledger entr${filtered.length === 1 ? 'y' : 'ies'}`);
    else if (outcome === 'failed') toast('error', 'The file could not be saved here. Try again, or open the app in a browser tab.');
  };

  return (
    <div>
      <PageHeader
        title="Gold Ledger"
        subtitle="Every gram given to and received from karigars"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(true)}>
              <Plus size={17} /> Adjustment
            </Button>
            <Button onClick={exportCSV}>
              <Download size={17} /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
            Total gold with karigars
            <InfoTip>
              Gold issued minus finished metal, scrap and approved loss returned. Each purity is shown separately because 22K and 18K gold are not interchangeable.
            </InfoTip>
          </div>
          <div className="mt-3 space-y-2">
            {Object.keys(outstanding).length === 0 ? (
              <div className="weight text-[22px] font-semibold">0.000 g</div>
            ) : (
              Object.entries(outstanding).map(([p, g]) => (
                <div key={p} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="rounded-md bg-gold-50 px-2 py-0.5 text-sm font-semibold text-gold-700 ring-1 ring-inset ring-gold-200">{p}</span>
                  <span className="weight text-[24px] font-semibold">
                    {formatGramsValue(g)}
                    <span className="ml-1 font-sans text-sm font-normal text-ink-3">g</span>
                  </span>
                </div>
              ))
            )}
          </div>
          {unreconciledCount > 0 && (
            <button onClick={() => set('open', f.open ? '' : '1')} className="mt-4 text-sm font-medium text-warn underline-offset-2 hover:underline">
              {unreconciledCount} entries not yet reconciled →
            </button>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Balance by karigar" subtitle="What each karigar is holding, per purity" icon={<Scale size={17} />} />
          <div className="mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-3">
                  <th className="py-2 pl-4 pr-2 text-left font-medium sm:pl-5">Karigar</th>
                  {balancePurities.map((p) => (
                    <th key={p} className="px-2 py-2 text-right font-medium">
                      {p}
                    </th>
                  ))}
                  {balancePurities.length === 0 && <th className="px-2 py-2 pr-5 text-right font-medium">Balance</th>}
                </tr>
              </thead>
              <tbody>
                {karigarRows.map((k) => {
                  const b = balances.get(k.id) ?? {};
                  return (
                    <tr key={k.id} className="border-b border-line/70 last:border-0">
                      <td className="py-2.5 pl-4 pr-2 sm:pl-5">
                        <Link to={`/karigars/${k.id}`} className="flex items-center gap-2.5 hover:underline">
                          <Avatar name={k.name} className="hidden h-7 w-7 text-[11px] sm:flex" />
                          <span className="font-medium">{k.name}</span>
                        </Link>
                      </td>
                      {balancePurities.map((p) => (
                        <td key={p} className={cn('weight px-2 py-2.5 text-right last:pr-4 sm:last:pr-5', !b[p] && 'text-ink-4')}>
                          {b[p] ? formatGramsValue(b[p]) : '—'}
                        </td>
                      ))}
                      {balancePurities.length === 0 && <td className="px-2 py-2.5 pr-5 text-right text-ink-4">—</td>}
                    </tr>
                  );
                })}
                {karigarRows.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-center text-ink-3" colSpan={2}>
                      No karigars yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {balancePurities.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line-strong bg-[#FCFAF6] font-semibold">
                    <td className="py-2.5 pl-4 pr-2 sm:pl-5">Total</td>
                    {balancePurities.map((p) => (
                      <td key={p} className="weight px-2 py-2.5 text-right last:pr-4 sm:last:pr-5">
                        {formatGramsValue(outstanding[p] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <Input type="search" aria-label="Search ledger" placeholder="Search by transaction ID, order ID, karigar or note" value={f.q} onChange={(e) => set('q', e.target.value)} className="pl-10" />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr]">
          <Select aria-label="Filter by karigar" value={f.karigar} onChange={(e) => set('karigar', e.target.value)} className="col-span-2 lg:col-span-1">
            <option value="all">All karigars</option>
            {data.karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="all">All types</option>
            {(Object.keys(TXN_TYPE_LABEL) as GoldTxnType[]).map((t) => (
              <option key={t} value={t}>
                {TXN_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by purity" value={f.purity} onChange={(e) => set('purity', e.target.value)}>
            <option value="all">All purities</option>
            {purities.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-ink-3">
            From
            <Input type="date" aria-label="From date" value={f.from} onChange={(e) => set('from', e.target.value)} className="min-w-0" />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-3">
            To
            <Input type="date" aria-label="To date" value={f.to} onChange={(e) => set('to', e.target.value)} className="min-w-0" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={f.open} onChange={(e) => set('open', e.target.checked ? '1' : '')} className="h-4 w-4 accent-ink" />
            Only entries not yet reconciled
          </label>
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <span>
              <span className="num font-medium text-ink">{filtered.length}</span> of {data.transactions.length} entries
            </span>
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
                <X size={14} /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <ReconLegend />
          <span className="text-xs text-ink-3">Weights show the effect on the karigar’s balance: + given, − received back</span>
        </div>
        {filtered.length ? (
          <LedgerTable rows={filtered.map((txn) => ({ txn }))} data={data} onVoid={setVoiding} />
        ) : (
          <EmptyState
            icon={<BookOpenText size={20} />}
            title={data.transactions.length ? 'No entries match' : 'No gold movements yet'}
            body={data.transactions.length ? 'Try clearing the filters.' : 'Entries appear here when you issue gold to a karigar from an order.'}
          />
        )}
      </Card>

      <AdjustmentDialog open={adjusting} onClose={() => setAdjusting(false)} />
      <VoidDialog open={!!voiding} onClose={() => setVoiding(undefined)} txn={voiding} />
    </div>
  );
}

function AdjustmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, today, run } = useStore();
  const karigars = data.karigars.filter((k) => !k.archived);
  const [karigarId, setKarigarId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [purity, setPurity] = useState('22K');
  const [weight, setWeight] = useState('');
  const [direction, setDirection] = useState<AdjustmentDirection>('reduce');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setKarigarId(karigars[0]?.id ?? '');
      setOrderId('');
      setPurity('22K');
      setWeight('');
      setDirection('reduce');
      setDate(today);
      setNotes('');
      setError(undefined);
    }
  }
  const theirOrders = data.orders.filter((o) => o.assignment?.karigarId === karigarId);
  const save = () => {
    const w = parseWeight(weight, { allowZero: false });
    if (!karigarId) return setError('Choose a karigar');
    if (!w.ok) return setError(w.error);
    if (!notes.trim()) return setError('Explain why this adjustment is needed — it stays on record');
    const ok = run((d) => ops.addAdjustment(d, { karigarId, orderId: orderId || undefined, purity, weight: w.value, direction, date, notes }).data, 'Adjustment recorded');
    if (ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an adjustment"
      subtitle="For corrections that are not a normal issue or return"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Record adjustment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Karigar" htmlFor="adj-k">
          <Select id="adj-k" value={karigarId} onChange={(e) => { setKarigarId(e.target.value); setOrderId(''); }}>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order" htmlFor="adj-o" optional>
          <Select id="adj-o" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Not linked to an order</option>
            {theirOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.customerName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Effect on karigar’s balance">
          <Segmented
            name="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'reduce', label: 'Reduce (owes less)' },
              { value: 'increase', label: 'Increase (owes more)' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purity" htmlFor="adj-p">
            <Input id="adj-p" value={purity} onChange={(e) => setPurity(e.target.value)} list="adj-purities" />
            <datalist id="adj-purities">
              <option value="22K" />
              <option value="18K" />
            </datalist>
          </Field>
          <Field label="Weight" htmlFor="adj-w">
            <WeightInput id="adj-w" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
        </div>
        <Field label="Date" htmlFor="adj-d">
          <Input id="adj-d" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason" htmlFor="adj-n">
          <Textarea id="adj-n" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px]" placeholder="e.g. Karigar settled 0.700 g balance in cash at today’s rate" />
        </Field>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  );
}
