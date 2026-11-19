import { Archive, ChevronRight, Phone, Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, PurityBalances } from '../components/domain';
import { KarigarDialog } from '../components/KarigarDialog';
import { Button, Card, EmptyState, Input, PageHeader } from '../components/ui';
import { allKarigarBalances } from '../lib/calculations';
import { formatPhone } from '../lib/format';
import { karigarJobStats } from '../lib/orders';
import { useStore } from '../store/StoreProvider';

export default function Karigars() {
  const { data } = useStore();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const balances = allKarigarBalances(data.transactions);
  const archivedCount = data.karigars.filter((k) => k.archived).length;
  const list = data.karigars
    .filter((k) => (showArchived ? k.archived : !k.archived))
    .filter((k) => !q.trim() || `${k.name} ${k.specialisation} ${k.phone}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Karigars"
        subtitle="The goldsmiths you give work to, and the gold each one is holding"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} /> Add karigar
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <Input type="search" aria-label="Search karigars" placeholder="Search karigars" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        {(archivedCount > 0 || showArchived) && (
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
            <Archive size={15} /> {showArchived ? 'Show active karigars' : `Show archived (${archivedCount})`}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={20} />}
            title={showArchived ? 'No archived karigars' : q ? 'No karigars match' : 'No karigars yet'}
            body={showArchived || q ? undefined : 'Add the goldsmiths you work with so you can assign orders and track gold given to them.'}
            action={
              !showArchived && !q && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={17} /> Add karigar
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((k) => {
            const s = karigarJobStats(k.id, data.orders);
            const bal = balances.get(k.id) ?? {};
            return (
              <Card key={k.id} className="flex flex-col">
                <Link to={`/karigars/${k.id}`} className="flex flex-1 flex-col p-4 hover:bg-[#FCFAF6] sm:p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={k.name} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[16px] font-semibold">{k.name}</span>
                        {k.archived && <span className="rounded bg-sunken px-1.5 text-[11px] text-ink-3">Archived</span>}
                      </div>
                      <div className="text-sm text-ink-3">{k.specialisation || 'General work'}</div>
                    </div>
                    <ChevronRight size={18} className="mt-1 text-ink-4" />
                  </div>
                  <div className="mt-4 rounded-xl bg-[#FCFAF6] px-3.5 py-3 ring-1 ring-line">
                    <div className="text-[12px] text-ink-3">Gold currently with karigar</div>
                    <PurityBalances balances={bal} empty="None" className="mt-1" />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Active', s.active],
                      ['Pending start', s.pending],
                      ['Completed', s.completed],
                    ].map(([label, n]) => (
                      <div key={label as string}>
                        <dd className="num text-lg font-semibold">{n}</dd>
                        <dt className="text-[12px] text-ink-3">{label}</dt>
                      </div>
                    ))}
                  </dl>
                </Link>
                {k.phone && (
                  <a href={`tel:${k.phone}`} className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-sm text-ink-2 hover:text-gold-700 sm:px-5">
                    <Phone size={14} /> {formatPhone(k.phone)}
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <KarigarDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
