import { ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { issuedByPurity, orderGoldSummary } from '../lib/calculations';
import { itemTitle } from '../lib/orders';
import type { AppData, Order } from '../lib/types';
import { DueDate, PurityBalances, ReconBadge, StatusBadge } from './domain';

/**
 * Orders as a table on desktop and as stacked cards on phones,
 * so nothing important needs horizontal scrolling.
 */
export function OrderList({ orders, data, today, showRecon = false }: { orders: Order[]; data: AppData; today: string; showRecon?: boolean }) {
  const navigate = useNavigate();
  const karigarName = (o: Order) => data.karigars.find((k) => k.id === o.assignment?.karigarId)?.name;
  const tol = data.settings.toleranceGrams;

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-3">
              <th className="py-2.5 pl-5 pr-3 font-medium">Order</th>
              <th className="px-3 py-2.5 font-medium">Customer · Item</th>
              <th className="px-3 py-2.5 font-medium">Karigar</th>
              <th className="px-3 py-2.5 font-medium">Delivery</th>
              <th className="px-3 py-2.5 text-right font-medium">Gold issued</th>
              <th className="py-2.5 pl-3 pr-5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const recon = orderGoldSummary(o, data.transactions, tol).status;
              return (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-[#FCFAF6]"
                >
                  <td className="py-3 pl-5 pr-3 align-top">
                    <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="num whitespace-nowrap font-medium text-ink hover:underline">
                      {o.id}
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-ink">{o.customerName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-ink-3">
                      {itemTitle(o)}
                      {o.designImage && <ImageIcon size={13} aria-label="Has design photo" />}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-ink-2">{karigarName(o) ?? <span className="text-ink-4">Not assigned</span>}</td>
                  <td className="px-3 py-3 align-top">
                    <DueDate order={o} today={today} dueSoonDays={data.settings.dueSoonDays} />
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <PurityBalances balances={issuedByPurity(o.id, data.transactions)} empty="—" size="sm" className="justify-end" />
                  </td>
                  <td className="py-3 pl-3 pr-5 align-top">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={o.status} />
                      {(showRecon || recon === 'discrepancy') && recon !== 'no_gold' && <ReconBadge status={recon} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="divide-y divide-line md:hidden">
        {orders.map((o) => {
          const recon = orderGoldSummary(o, data.transactions, tol).status;
          const issued = issuedByPurity(o.id, data.transactions);
          return (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-sunken">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[13px] font-medium text-ink-3">{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 truncate text-[15px] font-medium text-ink">{o.customerName}</div>
                  <div className="truncate text-sm text-ink-3">
                    {itemTitle(o)} · {karigarName(o) ?? 'Not assigned'}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 text-sm">
                    <DueDate order={o} today={today} dueSoonDays={data.settings.dueSoonDays} />
                    {Object.keys(issued).length > 0 && <PurityBalances balances={issued} size="sm" />}
                  </div>
                  {(showRecon || recon === 'discrepancy') && recon !== 'no_gold' && (
                    <div className="mt-2">
                      <ReconBadge status={recon} />
                    </div>
                  )}
                </div>
                <ChevronRight size={18} className="mt-6 shrink-0 text-ink-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
