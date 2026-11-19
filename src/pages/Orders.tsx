import { Plus, ScrollText, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { OrderList } from '../components/OrderList';
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select } from '../components/ui';
import { filterOrders, STATUS_LABEL, STATUS_ORDER, type DueFilter, type OrderFilters } from '../lib/orders';
import type { OrderStatus } from '../lib/types';
import { useStore } from '../store/StoreProvider';

const DUE_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: 'all', label: 'Any delivery date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due in next 7 days' },
  { value: 'month', label: 'Due this month' },
  { value: 'custom', label: 'Choose dates…' },
];

export default function Orders() {
  const { data, today } = useStore();
  const [params, setParams] = useSearchParams();

  const filters: OrderFilters = {
    q: params.get('q') ?? '',
    status: (params.get('status') as OrderFilters['status']) ?? 'all',
    karigar: params.get('karigar') ?? 'all',
    due: (params.get('due') as DueFilter) ?? 'all',
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    recon: params.get('recon') === 'attention' ? 'attention' : 'all',
  };

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key === 'due' && value !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setParams(next, { replace: true });
  };

  const results = filterOrders(data, filters, today);
  const active = [...params.keys()].length > 0;
  const karigars = data.karigars;

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${data.orders.length} order${data.orders.length === 1 ? '' : 's'} in total`}
        actions={
          <ButtonLink to="/orders/new">
            <Plus size={18} /> New Order
          </ButtonLink>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <Input
            type="search"
            aria-label="Search orders"
            placeholder="Search by customer, phone, order ID or item"
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Select aria-label="Filter by status" value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Active (not delivered)</option>
            {STATUS_ORDER.map((s: OrderStatus) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by karigar" value={filters.karigar} onChange={(e) => set('karigar', e.target.value)}>
            <option value="all">All karigars</option>
            <option value="none">Not assigned yet</option>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.archived ? ' (archived)' : ''}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by delivery date" value={filters.due} onChange={(e) => set('due', e.target.value)}>
            {DUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {filters.due === 'custom' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:max-w-md">
            <label className="text-sm text-ink-3">
              From
              <Input type="date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} className="mt-1" />
            </label>
            <label className="text-sm text-ink-3">
              To
              <Input type="date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} className="mt-1" />
            </label>
          </div>
        )}
        {(active || filters.recon === 'attention') && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-3">
              Showing <span className="num font-medium text-ink">{results.length}</span> of {data.orders.length}
            </span>
            {filters.recon === 'attention' && (
              <button
                onClick={() => set('recon', '')}
                className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-medium text-warn"
              >
                Pending reconciliation <X size={12} />
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              <X size={14} /> Clear filters
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {results.length ? (
          <OrderList orders={results} data={data} today={today} showRecon={filters.recon === 'attention'} />
        ) : data.orders.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={20} />}
            title="No orders yet"
            body="When a customer places an order, add it here. It takes under a minute."
            action={
              <ButtonLink to="/orders/new">
                <Plus size={17} /> New Order
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<Search size={20} />}
            title="No orders match"
            body="Try a different search or clear the filters."
            action={
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}
