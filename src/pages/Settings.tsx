import { Database, Download, RotateCcw, Scale, Store, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { DemoTag } from '../components/domain';
import { Button, Card, CardHeader, ConfirmDialog, Field, Input, PageHeader, Select, Textarea, WeightInput } from '../components/ui';
import { downloadText } from '../lib/csv';
import { formatGrams, formatGramsValue } from '../lib/format';
import type { AppData } from '../lib/types';
import { parsePhone, parseWeight } from '../lib/validation';
import * as ops from '../store/operations';
import { parseBackup, STORAGE_KEY } from '../store/storage';
import { useStore } from '../store/StoreProvider';

export default function Settings() {
  const { data, today, run, toast, resetDemo, clearAll, replaceAll } = useStore();
  const s = data.settings;
  const [shopName, setShopName] = useState(s.shopName);
  const [ownerName, setOwnerName] = useState(s.ownerName);
  const [phone, setPhone] = useState(s.phone);
  const [address, setAddress] = useState(s.address);
  const [tolerance, setTolerance] = useState(formatGramsValue(s.toleranceGrams));
  const [dueSoon, setDueSoon] = useState(String(s.dueSoonDays));
  const [stale, setStale] = useState(String(s.staleJobDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<null | 'reset' | 'clear' | { restore: AppData; name: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { hash } = useLocation();

  // Re-sync the form if settings change elsewhere (e.g. after reset)
  useEffect(() => {
    setShopName(s.shopName);
    setOwnerName(s.ownerName);
    setPhone(s.phone);
    setAddress(s.address);
    setTolerance(formatGramsValue(s.toleranceGrams));
    setDueSoon(String(s.dueSoonDays));
    setStale(String(s.staleJobDays));
  }, [s]);

  useEffect(() => {
    if (hash === '#data') setTimeout(() => document.getElementById('data')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [hash]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!shopName.trim()) errs.shopName = 'Enter the shop name';
    const p = parsePhone(phone);
    if (!p.ok) errs.phone = p.error;
    const t = parseWeight(tolerance);
    if (!t.ok) errs.tolerance = t.error;
    else if (t.value > 10) errs.tolerance = 'That seems too high — please check';
    const ds = Number(dueSoon);
    if (!/^\d+$/.test(dueSoon) || ds > 60) errs.dueSoon = 'Enter whole days, 0–60';
    const st = Number(stale);
    if (!/^\d+$/.test(stale) || st < 1 || st > 90) errs.stale = 'Enter whole days, 1–90';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    run(
      (d) =>
        ops.updateSettings(d, {
          ...d.settings,
          shopName,
          ownerName: ownerName.trim(),
          phone: p.ok ? p.value : '',
          address: address.trim(),
          toleranceGrams: t.ok ? t.value : d.settings.toleranceGrams,
          dueSoonDays: ds,
          staleJobDays: st,
        }),
      'Settings saved',
    );
  };

  const backup = async () => {
    const slug = s.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop';
    const outcome = await downloadText(`karigarsetu-backup-${slug}-${today}.json`, JSON.stringify(data, null, 2), 'application/json');
    if (outcome === 'saved') toast('success', 'Backup downloaded. Keep it somewhere safe.');
    else if (outcome === 'failed') toast('error', 'The backup could not be saved here. Try again, or open the app in a browser tab.');
  };

  const onRestoreFile = async (file?: File) => {
    if (!file) return;
    try {
      const restored = parseBackup(await file.text());
      setConfirm({ restore: restored, name: file.name });
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  let usedKB = 0;
  try {
    usedKB = Math.round(((localStorage.getItem(STORAGE_KEY)?.length ?? 0) * 2) / 1024);
  } catch {
    /* storage unavailable */
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Shop details, gold tolerance and your data" />

      <form onSubmit={save} noValidate className="space-y-5">
        <Card>
          <CardHeader title="Shop" icon={<Store size={17} />} />
          <div className="grid gap-4 px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-5">
            <Field label="Shop name" htmlFor="s-name" error={errors.shopName}>
              <Input id="s-name" value={shopName} onChange={(e) => setShopName(e.target.value)} invalid={!!errors.shopName} />
            </Field>
            <Field label="Owner name" htmlFor="s-owner" optional>
              <Input id="s-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </Field>
            <Field label="Contact number" htmlFor="s-phone" error={errors.phone} optional>
              <Input id="s-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} />
            </Field>
            <Field label="Currency" htmlFor="s-currency" hint="Only Indian Rupees are supported in this version.">
              <Select id="s-currency" value="INR" disabled>
                <option value="INR">Indian Rupee (₹) — ₹1,23,456</option>
              </Select>
            </Field>
            <Field label="Address" htmlFor="s-address" className="sm:col-span-2" optional>
              <Textarea id="s-address" value={address} onChange={(e) => setAddress(e.target.value)} className="min-h-[60px]" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Gold checks & reminders" icon={<Scale size={17} />} />
          <div className="grid gap-4 px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-5">
            <Field
              label="Discrepancy tolerance"
              htmlFor="s-tol"
              error={errors.tolerance}
              className="sm:col-span-2"
              hint={
                <>
                  An unexplained difference <strong className="font-medium text-ink-2">larger than</strong> this is flagged on the order and dashboard. Set it to what you consider normal
                  weighing variation on your scale — the app does not assume any standard wastage. Currently {formatGrams(s.toleranceGrams)}.
                </>
              }
            >
              <WeightInput id="s-tol" value={tolerance} onChange={(e) => setTolerance(e.target.value)} invalid={!!errors.tolerance} className="max-w-[180px]" />
            </Field>
            <Field label="“Due soon” means within" htmlFor="s-due" error={errors.dueSoon}>
              <Input id="s-due" inputMode="numeric" value={dueSoon} onChange={(e) => setDueSoon(e.target.value)} suffix="days" invalid={!!errors.dueSoon} />
            </Field>
            <Field label="Flag jobs with no update after" htmlFor="s-stale" error={errors.stale}>
              <Input id="s-stale" inputMode="numeric" value={stale} onChange={(e) => setStale(e.target.value)} suffix="days" invalid={!!errors.stale} />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save settings
          </Button>
        </div>
      </form>

      <Card className="mt-8 scroll-mt-20" id="data">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              Your data {data.isDemo && <DemoTag />}
            </span>
          }
          subtitle={`Stored only in this browser on this device (about ${usedKB} KB). Nothing is sent to any server.`}
          icon={<Database size={17} />}
        />
        <div className="divide-y divide-line px-4 pb-2 pt-2 sm:px-5">
          <Row title="Download backup" body="Save everything as a JSON file. Do this regularly — clearing browser data deletes your records.">
            <Button variant="secondary" onClick={backup}>
              <Download size={16} /> Download
            </Button>
          </Row>
          <Row title="Restore from backup" body="Replace all current data with a backup file you downloaded earlier.">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Choose file
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onRestoreFile(e.target.files?.[0])} data-testid="restore-input" />
          </Row>
          <Row title="Reset demo data" body="Replace everything with the illustrative demo shop, dated relative to today.">
            <Button variant="secondary" onClick={() => setConfirm('reset')}>
              <RotateCcw size={16} /> Reset demo
            </Button>
          </Row>
          <Row title="Clear all data" body="Start with an empty register for your own shop. This cannot be undone.">
            <Button variant="secondary" className="text-bad" onClick={() => setConfirm('clear')}>
              <Trash2 size={16} /> Clear all
            </Button>
          </Row>
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-4">KarigarSetu MVP · weights in grams (up to 3 decimals) · amounts in ₹</p>

      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        title="Reset to demo data?"
        confirmLabel="Reset demo data"
        body="All current orders, karigars and ledger entries will be replaced by the demo shop. Download a backup first if you want to keep them."
        onConfirm={() => {
          resetDemo();
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onClose={() => setConfirm(null)}
        title="Clear all data?"
        confirmLabel="Clear everything"
        body={
          <>
            This permanently deletes <strong>{data.orders.length} orders</strong>, <strong>{data.karigars.length} karigars</strong> and{' '}
            <strong>{data.transactions.length} ledger entries</strong> from this browser. Your settings for tolerance and reminders are reset too.
          </>
        }
        onConfirm={() => {
          clearAll();
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={typeof confirm === 'object' && confirm !== null}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="Restore this backup?"
        confirmLabel="Replace with backup"
        body={
          typeof confirm === 'object' && confirm ? (
            <>
              <p>
                <strong>{confirm.name}</strong> contains {confirm.restore.orders.length} orders, {confirm.restore.karigars.length} karigars and{' '}
                {confirm.restore.transactions.length} ledger entries for “{confirm.restore.settings.shopName}”.
              </p>
              <p className="mt-2">Current data will be replaced.</p>
            </>
          ) : null
        }
        onConfirm={() => {
          if (typeof confirm === 'object' && confirm) replaceAll(confirm.restore, 'Backup restored');
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1 basis-60">
        <div className="text-[15px] font-medium">{title}</div>
        <div className="text-sm text-ink-3">{body}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
