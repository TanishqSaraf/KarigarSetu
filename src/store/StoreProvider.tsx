import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildDemoData, emptyData } from '../data/demo';
import { todayISO } from '../lib/dates';
import type { AppData } from '../lib/types';
import { ValidationError } from '../lib/validation';
import { loadData, saveData } from './storage';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface StoreValue {
  data: AppData;
  today: string;
  /**
   * Run a change. `fn` receives the latest data and returns the next data (or throws a ValidationError).
   * Returns true on success. Shows a toast for success (if given) or the error message.
   */
  run: (fn: (d: AppData) => AppData, success?: string) => boolean;
  replaceAll: (d: AppData, message: string) => void;
  resetDemo: () => void;
  clearAll: () => void;
  toast: (kind: ToastKind, message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadData());
  const [data, setData] = useState<AppData>(initial.current.data);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [today, setToday] = useState(todayISO());

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  // Persist every change. localStorage is limited (~5 MB), mostly a concern with design photos.
  const persist = useCallback(
    (next: AppData): boolean => {
      try {
        saveData(next);
        return true;
      } catch {
        toast('error', 'Could not save — browser storage is full. Try removing some design photos, or download a backup.');
        return false;
      }
    },
    [toast],
  );

  useEffect(() => {
    if (initial.current.source !== 'saved') persist(initial.current.data);
    if (initial.current.source === 'recovered') toast('error', 'Saved data could not be read, so the demo data was loaded instead.');
  }, [persist, toast]);

  // Keep "today" correct if the app is left open past midnight.
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Stay in sync if the app is open in two tabs.
  useEffect(() => {
    const onStorage = () => {
      const fresh = loadData();
      if (fresh.source === 'saved') setData(fresh.data);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = useCallback(
    (next: AppData) => {
      if (!persist(next)) return false;
      dataRef.current = next;
      setData(next);
      return true;
    },
    [persist],
  );

  const run = useCallback<StoreValue['run']>(
    (fn, success) => {
      try {
        const next = fn(dataRef.current);
        if (!commit(next)) return false;
        if (success) toast('success', success);
        return true;
      } catch (e) {
        if (e instanceof ValidationError) toast('error', e.message);
        else {
          console.error(e);
          toast('error', 'Something went wrong. Your data was not changed.');
        }
        return false;
      }
    },
    [commit, toast],
  );

  const value = useMemo<StoreValue>(
    () => ({
      data,
      today,
      run,
      toast,
      replaceAll: (d, message) => commit(d) && toast('success', message),
      resetDemo: () => commit(buildDemoData()) && toast('success', 'Demo data restored'),
      clearAll: () => {
        const fresh = emptyData();
        fresh.settings = { ...fresh.settings, shopName: dataRef.current.isDemo ? 'My Jewellery Shop' : dataRef.current.settings.shopName };
        if (commit(fresh)) toast('success', 'All data cleared. You are starting fresh.');
      },
    }),
    [data, today, run, toast, commit],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-ink px-4 py-3 text-[15px] text-white shadow-pop"
          >
            {t.kind === 'success' ? (
              <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#8FD3AC]" />
            ) : (
              <AlertCircle size={19} className="mt-0.5 shrink-0 text-[#F2A39B]" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="-mr-1 text-white/60 hover:text-white">
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
