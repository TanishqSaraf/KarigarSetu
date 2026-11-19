import { BookOpenText, LayoutDashboard, Plus, ScrollText, Settings as SettingsIcon, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';
import { isOverdue } from '../lib/orders';
import { useStore } from '../store/StoreProvider';
import { Logo } from './domain';
import { ButtonLink } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', short: 'Orders', icon: ScrollText },
  { to: '/karigars', label: 'Karigars', short: 'Karigars', icon: Users },
  { to: '/ledger', label: 'Gold Ledger', short: 'Ledger', icon: BookOpenText },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { data, today } = useStore();
  const { pathname } = useLocation();
  const overdue = data.orders.filter((o) => isOverdue(o, today)).length;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-[#FBF9F5] px-4 py-5 lg:flex">
        <Link to="/" className="px-2">
          <Logo />
        </Link>
        <div className="mt-6 px-2">
          <ButtonLink to="/orders/new" className="w-full">
            <Plus size={18} /> New Order
          </ButtonLink>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} className={isActive ? 'text-gold-600' : 'text-ink-3'} />
                  <span className="flex-1">{label}</span>
                  {to === '/orders' && overdue > 0 && (
                    <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad" title={`${overdue} overdue`}>
                      {overdue}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-surface px-3 py-3">
          <div className="truncate text-sm font-medium text-ink">{data.settings.shopName}</div>
          <div className="truncate text-xs text-ink-3">{data.settings.address || 'Add shop details in Settings'}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Logo compact />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold">{data.settings.shopName}</div>
              <div className="text-[11px] text-ink-3">KarigarSetu</div>
            </div>
          </Link>
          <ButtonLink to="/orders/new" size="sm" aria-label="New order">
            <Plus size={16} /> New
          </ButtonLink>
        </header>

        {data.isDemo && (
          <div className="border-b border-gold-200 bg-gold-50 px-4 py-2 text-[13px] text-gold-700 lg:px-8">
            <span className="font-semibold">Demo data.</span> Shop, karigars, customers and orders are fictional and for illustration only.{' '}
            <Link to="/settings#data" className="font-medium underline underline-offset-2 hover:text-ink">
              Reset or clear
            </Link>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-ink' : 'text-ink-3')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold-500" />}
                  <Icon size={21} className={isActive ? 'text-gold-600' : ''} />
                  {short}
                  {to === '/orders' && overdue > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 h-2 w-2 rounded-full bg-bad" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
