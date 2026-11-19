import { Archive, ArchiveRestore, ArrowLeft, BookOpenText, Pencil, Phone, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, PurityBalances } from '../components/domain';
import { KarigarDialog } from '../components/KarigarDialog';
import { LedgerTable, ReconLegend } from '../components/LedgerTable';
import { VoidDialog } from '../components/OrderDialogs';
import { OrderList } from '../components/OrderList';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Segmented } from '../components/ui';
import { karigarBalance, withRunningBalance } from '../lib/calculations';
import { formatGrams, formatPhone } from '../lib/format';
import { karigarJobStats, WITH_KARIGAR } from '../lib/orders';
import type { GoldTransaction } from '../lib/types';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';
import NotFound from './NotFound';

export default function KarigarDetail() {
  const { id } = useParams();
  const { data, today, run } = useStore();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [tab, setTab] = useState<'active' | 'done' | 'all'>('active');
  const [voiding, setVoiding] = useState<GoldTransaction>();
  const k = data.karigars.find((x) => x.id === id);
  if (!k) return <NotFound />;

  const stats = karigarJobStats(k.id, data.orders);
  const balance = karigarBalance(k.id, data.transactions);
  const mine = data.orders.filter((o) => o.assignment?.karigarId === k.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shown = mine.filter((o) => (tab === 'active' ? WITH_KARIGAR.includes(o.status) : tab === 'done' ? !WITH_KARIGAR.includes(o.status) : true));
  const ledger = withRunningBalance(data.transactions.filter((t) => t.karigarId === k.id)).reverse();
  const holding = Object.keys(balance).length > 0;

  return (
    <div>
      <Link to="/karigars" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} /> Karigars
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar name={k.name} className="h-14 w-14 text-base" />
          <div>
            <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight sm:text-[26px]">
              {k.name}
              {k.archived && <span className="rounded bg-sunken px-1.5 py-0.5 text-xs font-medium text-ink-3">Archived</span>}
            </h1>
            <p className="text-[15px] text-ink-3">{k.specialisation || 'General work'}</p>
            {k.phone && (
              <a href={`tel:${k.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-gold-700 hover:underline">
                <Phone size={13} /> {formatPhone(k.phone)}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </Button>
          {k.archived ? (
            <Button variant="secondary" size="sm" onClick={() => run((d) => ops.setKarigarArchived(d, k.id, false), `${k.name} restored`)}>
              <ArchiveRestore size={14} /> Restore
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirmArchive(true)}>
              <Archive size={14} /> Archive
            </Button>
          )}
        </div>
      </div>
      {k.notes && <p className="mb-5 max-w-2xl rounded-xl bg-sunken px-4 py-3 text-sm text-ink-2">{k.notes}</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Card className="p-4 sm:col-span-2 sm:p-5">
          <div className="text-[13px] font-medium text-ink-3">Gold currently with {k.name.split(' ')[0]}</div>
          <PurityBalances balances={balance} size="lg" empty="None" className="mt-2" />
          <p className="mt-2 text-xs text-ink-3">Includes any unexplained difference not yet settled. Each purity is kept separate.</p>
        </Card>
        {[
          ['Active jobs', stats.active, 'Gold issued / in progress'],
          ['Pending start', stats.pending, 'Assigned, not started'],
        ].map(([label, n, sub]) => (
          <Card key={label as string} className="p-4 sm:p-5">
            <div className="text-[13px] font-medium text-ink-3">{label}</div>
            <div className="num mt-2 text-[28px] font-semibold leading-none">{n}</div>
            <div className="mt-1.5 text-xs text-ink-3">{sub}</div>
          </Card>
        ))}
      </div>
      <p className="-mt-2 mb-5 text-sm text-ink-3">
        <span className="num font-medium text-ink">{stats.completed}</span> completed job{stats.completed === 1 ? '' : 's'} (received back) ·{' '}
        <span className="num font-medium text-ink">{stats.total}</span> in total
      </p>

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="Assigned orders"
          icon={<ScrollText size={17} />}
          action={
            <Segmented
              name="Order filter"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: 'With karigar' },
                { value: 'done', label: 'Returned' },
                { value: 'all', label: 'All' },
              ]}
              className="[&_button]:h-8 [&_button]:px-2.5 [&_button]:text-[13px]"
            />
          }
        />
        <div className="mt-3">
          {shown.length ? (
            <OrderList orders={shown} data={data} today={today} />
          ) : (
            <EmptyState title={tab === 'active' ? 'No jobs with this karigar right now' : 'No orders here'} />
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Gold ledger history" subtitle="Newest first, with running balance for each purity" icon={<BookOpenText size={17} />} />
        <div className="px-4 pt-3 sm:px-5">
          <ReconLegend />
        </div>
        <div className="mt-3">
          {ledger.length ? (
            <LedgerTable rows={ledger} data={data} showKarigar={false} onVoid={setVoiding} />
          ) : (
            <EmptyState title="No gold given to this karigar yet" />
          )}
        </div>
      </Card>

      <KarigarDialog open={editing} onClose={() => setEditing(false)} karigar={k} />
      <VoidDialog open={!!voiding} onClose={() => setVoiding(undefined)} txn={voiding} />
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={`Archive ${k.name}?`}
        confirmLabel="Archive karigar"
        body={
          <>
            <p>Archived karigars are hidden from new assignments. Their orders and gold records are kept and can still be viewed.</p>
            {holding && (
              <p className="mt-3 rounded-xl bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
                {k.name} still holds{' '}
                {Object.entries(balance)
                  .map(([p, g]) => `${formatGrams(g)} of ${p}`)
                  .join(' and ')}
                . Archiving does not clear this balance.
              </p>
            )}
            {stats.active + stats.pending > 0 && (
              <p className="mt-3 text-sm">They have {stats.active + stats.pending} open job(s), which will stay assigned to them.</p>
            )}
          </>
        }
        onConfirm={() => {
          if (run((d) => ops.setKarigarArchived(d, k.id, true), `${k.name} archived`)) setConfirmArchive(false);
        }}
      />
    </div>
  );
}
