import { Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderGoldSummary, txnEffect, type ReconStatus } from '../lib/calculations';
import { cn } from '../lib/cn';
import { adjustmentDetail } from '../lib/csv';
import { formatDate } from '../lib/dates';
import { formatGramsValue, formatSignedGrams } from '../lib/format';
import { TXN_TYPE_LABEL } from '../lib/orders';
import type { AppData, GoldTransaction } from '../lib/types';

export type TxnRecon = 'open' | 'difference' | 'closed' | 'none';

/** How the order behind a ledger entry stands — used to mark unreconciled entries. */
export function txnReconState(t: GoldTransaction, data: AppData): TxnRecon {
  if (!t.orderId) return 'none';
  const order = data.orders.find((o) => o.id === t.orderId);
  if (!order) return 'none';
  const s: ReconStatus = orderGoldSummary(order, data.transactions, data.settings.toleranceGrams).status;
  if (s === 'discrepancy') return 'difference';
  if (s === 'awaiting_return' || s === 'pending') return 'open';
  return 'closed';
}

export const TXN_RECON_LABEL: Record<TxnRecon, string> = {
  open: 'Not yet reconciled',
  difference: 'Difference beyond tolerance',
  closed: 'Reconciled',
  none: 'Not linked to an order',
};

const BAR: Record<TxnRecon, string> = {
  open: 'bg-warn',
  difference: 'bg-bad',
  closed: 'bg-ok/60',
  none: 'bg-line-strong',
};

export function ReconLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
      {(['difference', 'open', 'closed'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={cn('h-3 w-1 rounded-full', BAR[k])} />
          {TXN_RECON_LABEL[k]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-ink-4 line-through">0.000</span> Voided
      </span>
    </div>
  );
}

export function LedgerTable({
  rows,
  data,
  showKarigar = true,
  onVoid,
}: {
  rows: Array<{ txn: GoldTransaction; balanceAfter?: number }>;
  data: AppData;
  showKarigar?: boolean;
  onVoid?: (t: GoldTransaction) => void;
}) {
  const name = (id: string) => data.karigars.find((k) => k.id === id)?.name ?? '—';
  const showBalance = rows.some((r) => r.balanceAfter !== undefined);

  const Effect = ({ t }: { t: GoldTransaction }) => {
    const e = txnEffect(t);
    return (
      <span className={cn('weight whitespace-nowrap', t.voided ? 'text-ink-4 line-through' : e > 0 ? 'text-ink' : 'text-ok')}>
        {t.voided ? `${formatGramsValue(t.weight)} g` : formatSignedGrams(e)}
      </span>
    );
  };

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-3">
              <th className="w-1 p-0" aria-label="Reconciliation" />
              <th className="py-2.5 pl-4 pr-3 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Txn ID</th>
              {showKarigar && <th className="px-3 py-2.5 font-medium">Karigar</th>}
              <th className="px-3 py-2.5 font-medium">Order</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Purity</th>
              <th className="px-3 py-2.5 text-right font-medium">Weight</th>
              {showBalance && <th className="px-3 py-2.5 text-right font-medium">Balance after</th>}
              {onVoid && <th className="w-10 pr-4" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ txn: t, balanceAfter }) => {
              const state = txnReconState(t, data);
              return (
                <tr key={t.id} className={cn('border-b border-line/70 last:border-0', t.voided && 'bg-sunken/50')} data-recon={state}>
                  <td className="p-0">
                    <span className={cn('block h-full min-h-[44px] w-1', t.voided ? 'bg-transparent' : BAR[state])} title={TXN_RECON_LABEL[state]} />
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-ink-2">{formatDate(t.date)}</td>
                  <td className="num px-3 py-2.5 text-ink-2">{t.id}</td>
                  {showKarigar && (
                    <td className="px-3 py-2.5">
                      <Link to={`/karigars/${t.karigarId}`} className="hover:underline">
                        {name(t.karigarId)}
                      </Link>
                    </td>
                  )}
                  <td className="num px-3 py-2.5">
                    {t.orderId ? (
                      <Link to={`/orders/${t.orderId}`} className="text-gold-700 hover:underline">
                        {t.orderId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={cn(t.voided && 'text-ink-4 line-through')}>{TXN_TYPE_LABEL[t.type]}</div>
                    {t.type === 'adjustment' && <div className="text-xs text-ink-3">{adjustmentDetail(t)}</div>}
                    {t.voided && <div className="text-xs text-bad">Voided: {t.voided.reason}</div>}
                    {!t.voided && t.notes && <div className="max-w-[260px] truncate text-xs text-ink-3" title={t.notes}>{t.notes}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gold-700">{t.purity}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Effect t={t} />
                  </td>
                  {showBalance && (
                    <td className="weight px-3 py-2.5 text-right text-ink-2">{balanceAfter !== undefined ? `${formatGramsValue(balanceAfter)} g` : ''}</td>
                  )}
                  {onVoid && (
                    <td className="pr-4">
                      {!t.voided && (
                        <button onClick={() => onVoid(t)} className="rounded-md p-1 text-ink-4 hover:bg-sunken hover:text-bad" aria-label={`Void ${t.id}`} title="Void this entry">
                          <Ban size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map(({ txn: t, balanceAfter }) => {
          const state = txnReconState(t, data);
          return (
            <li key={t.id} className={cn('relative flex gap-3 py-3 pl-5 pr-4', t.voided && 'bg-sunken/50')} data-recon={state}>
              <span className={cn('absolute inset-y-2 left-0 w-1 rounded-r-full', t.voided ? 'bg-transparent' : BAR[state])} />
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-medium', t.voided && 'text-ink-4 line-through')}>{TXN_TYPE_LABEL[t.type]}</div>
                <div className="mt-0.5 text-[13px] text-ink-3">
                  {formatDate(t.date)} · <span className="num">{t.id}</span>
                  {t.orderId && (
                    <>
                      {' · '}
                      <Link to={`/orders/${t.orderId}`} className="num text-gold-700">
                        {t.orderId}
                      </Link>
                    </>
                  )}
                </div>
                {showKarigar && <div className="text-[13px] text-ink-2">{name(t.karigarId)}</div>}
                {t.type === 'adjustment' && <div className="text-xs text-ink-3">{adjustmentDetail(t)}</div>}
                {t.voided && <div className="text-xs text-bad">Voided: {t.voided.reason}</div>}
                {state === 'difference' && !t.voided && <div className="text-xs font-medium text-bad">{TXN_RECON_LABEL[state]}</div>}
              </div>
              <div className="shrink-0 text-right">
                <Effect t={t} />
                <div className="text-[11px] font-medium text-gold-700">{t.purity}</div>
                {balanceAfter !== undefined && <div className="weight text-[11px] text-ink-3">bal {formatGramsValue(balanceAfter)}</div>}
                {onVoid && !t.voided && (
                  <button onClick={() => onVoid(t)} className="mt-1 text-[11px] text-ink-4 underline" aria-label={`Void ${t.id}`}>
                    Void
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
