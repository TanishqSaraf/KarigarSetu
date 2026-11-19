import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Field, Input, MoneyInput, PageHeader, Segmented, Select, Textarea, WeightInput } from '../components/ui';
import { addDays } from '../lib/dates';
import { formatGramsValue, formatINR } from '../lib/format';
import { compressImage } from '../lib/image';
import type { JewelleryCategory, MetalType, Order, OrderType } from '../lib/types';
import { parseAmount, parsePhone, parseWeight } from '../lib/validation';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';
import NotFound from './NotFound';

const CATEGORIES: JewelleryCategory[] = ['Ring', 'Necklace', 'Bracelet', 'Earrings', 'Other'];
const METALS: MetalType[] = ['Yellow gold', 'White gold', 'Rose gold'];

interface FormState {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  category: JewelleryCategory;
  categoryOther: string;
  metalType: MetalType;
  purityChoice: '22K' | '18K' | 'Other';
  purityOther: string;
  expectedWeight: string;
  orderDate: string;
  deliveryDate: string;
  advance: string;
  makingCharges: string;
  estimatedTotal: string;
  description: string;
  designImage?: string;
}

function initialState(order: Order | undefined, today: string): FormState {
  if (!order)
    return {
      customerName: '',
      customerPhone: '',
      orderType: 'Custom',
      category: 'Ring',
      categoryOther: '',
      metalType: 'Yellow gold',
      purityChoice: '22K',
      purityOther: '',
      expectedWeight: '',
      orderDate: today,
      deliveryDate: addDays(today, 14),
      advance: '',
      makingCharges: '',
      estimatedTotal: '',
      description: '',
    };
  const preset = order.purity === '22K' || order.purity === '18K';
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderType: order.orderType,
    category: order.category,
    categoryOther: order.categoryOther ?? '',
    metalType: order.metalType,
    purityChoice: preset ? (order.purity as '22K' | '18K') : 'Other',
    purityOther: preset ? '' : order.purity,
    expectedWeight: order.expectedWeight ? formatGramsValue(order.expectedWeight).replace(/,/g, '') : '',
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    advance: order.advance ? String(order.advance) : '',
    makingCharges: order.makingCharges ? String(order.makingCharges) : '',
    estimatedTotal: order.estimatedTotal && order.estimatedTotal !== order.makingCharges ? String(order.estimatedTotal) : '',
    description: order.description,
    designImage: order.designImage,
  };
}

function Section({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function OrderForm() {
  const { id } = useParams();
  const { data, today, run, toast } = useStore();
  const navigate = useNavigate();
  const editing = id ? data.orders.find((o) => o.id === id) : undefined;
  const [f, setF] = useState<FormState>(() => initialState(editing, today));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busyImage, setBusyImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (id && !editing) return <NotFound />;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const making = parseAmount(f.makingCharges);
  const totalPreview = f.estimatedTotal.trim() ? parseAmount(f.estimatedTotal) : making;
  const advancePreview = parseAmount(f.advance);
  const remainingPreview =
    totalPreview.ok && advancePreview.ok ? Math.round((totalPreview.value - advancePreview.value) * 100) / 100 : null;

  const onImage = async (file?: File) => {
    if (!file) return;
    setBusyImage(true);
    try {
      set('designImage', await compressImage(file));
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusyImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!f.customerName.trim()) errs.customerName = 'Enter the customer name';
    const phone = parsePhone(f.customerPhone);
    if (!phone.ok) errs.customerPhone = phone.error;
    if (f.category === 'Other' && !f.categoryOther.trim()) errs.categoryOther = 'Describe the item, e.g. Mangalsutra';
    if (f.purityChoice === 'Other' && !f.purityOther.trim()) errs.purityOther = 'Enter the purity, e.g. 14K';
    const weight = parseWeight(f.expectedWeight, { required: false });
    if (!weight.ok) errs.expectedWeight = weight.error;
    if (!f.orderDate) errs.orderDate = 'Choose the order date';
    if (!f.deliveryDate) errs.deliveryDate = 'Choose the delivery date';
    else if (f.orderDate && f.deliveryDate < f.orderDate) errs.deliveryDate = 'Delivery cannot be before the order date';
    const adv = parseAmount(f.advance);
    if (!adv.ok) errs.advance = adv.error;
    if (!making.ok) errs.makingCharges = making.error;
    const total = f.estimatedTotal.trim() ? parseAmount(f.estimatedTotal) : making;
    if (f.estimatedTotal.trim() && !total.ok) errs.estimatedTotal = total.error;
    if (adv.ok && total.ok && total.value > 0 && adv.value > total.value) errs.advance = 'Advance is more than the estimated total';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('error', 'Please fix the highlighted fields');
      return;
    }
    const input: ops.OrderInput = {
      customerName: f.customerName,
      customerPhone: phone.ok ? phone.value : '',
      orderType: f.orderType,
      category: f.category,
      categoryOther: f.category === 'Other' ? f.categoryOther.trim() : undefined,
      metalType: f.metalType,
      purity: f.purityChoice === 'Other' ? f.purityOther : f.purityChoice,
      expectedWeight: weight.ok ? weight.value : 0,
      orderDate: f.orderDate,
      deliveryDate: f.deliveryDate,
      advance: adv.ok ? adv.value : 0,
      makingCharges: making.ok ? making.value : 0,
      estimatedTotal: total.ok ? total.value : 0,
      description: f.description,
      designImage: f.designImage,
    };
    if (editing) {
      if (run((d) => ops.updateOrder(d, editing.id, input), `${editing.id} updated`)) navigate(`/orders/${editing.id}`);
    } else {
      let newId = '';
      const ok = run((d) => {
        const r = ops.createOrder(d, input);
        newId = r.id;
        return r.data;
      });
      if (ok) {
        toast('success', `Order ${newId} created`);
        navigate(`/orders/${newId}`);
      }
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link to={editing ? `/orders/${editing.id}` : '/orders'} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
            <ArrowLeft size={16} /> {editing ? `Back to ${editing.id}` : 'Orders'}
          </Link>
        }
        title={editing ? `Edit ${editing.id}` : 'New order'}
        subtitle={editing ? 'Changes to dates and amounts are noted in the order timeline.' : 'An order ID is created automatically when you save.'}
      />

      <div className="space-y-4">
        <Section title="Customer">
          <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
            <Input id="customerName" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} invalid={!!errors.customerName} autoComplete="off" placeholder="e.g. Sunita Agarwal" />
          </Field>
          <Field label="Phone number" htmlFor="customerPhone" error={errors.customerPhone} optional>
            <Input id="customerPhone" type="tel" inputMode="tel" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} invalid={!!errors.customerPhone} placeholder="10-digit mobile" />
          </Field>
        </Section>

        <Section title="Jewellery">
          <Field label="Order type" className="sm:col-span-2">
            <Segmented
              name="Order type"
              value={f.orderType}
              onChange={(v) => set('orderType', v)}
              options={[
                { value: 'Custom', label: 'Custom — new piece' },
                { value: 'Repair', label: 'Repair' },
              ]}
            />
          </Field>
          <Field label="Item" className="sm:col-span-2">
            <Segmented name="Jewellery category" value={f.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          {f.category === 'Other' && (
            <Field label="What item?" htmlFor="categoryOther" error={errors.categoryOther} className="sm:col-span-2">
              <Input id="categoryOther" value={f.categoryOther} onChange={(e) => set('categoryOther', e.target.value)} invalid={!!errors.categoryOther} placeholder="e.g. Mangalsutra, Bangles, Chain, Pendant" />
            </Field>
          )}
          <Field label="Metal" htmlFor="metalType">
            <Select id="metalType" value={f.metalType} onChange={(e) => set('metalType', e.target.value as MetalType)}>
              {METALS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Purity" error={errors.purityOther}>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                name="Purity"
                value={f.purityChoice}
                onChange={(v) => set('purityChoice', v)}
                options={[
                  { value: '22K', label: '22K' },
                  { value: '18K', label: '18K' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
              {f.purityChoice === 'Other' && (
                <Input aria-label="Other purity" value={f.purityOther} onChange={(e) => set('purityOther', e.target.value)} placeholder="e.g. 14K" className="w-28" invalid={!!errors.purityOther} />
              )}
            </div>
          </Field>
          <Field
            label="Expected finished weight"
            htmlFor="expectedWeight"
            error={errors.expectedWeight}
            hint={f.orderType === 'Repair' ? "For repairs, note the customer's item weight as received." : 'Approximate weight of the finished piece, up to 3 decimals.'}
          >
            <WeightInput id="expectedWeight" value={f.expectedWeight} onChange={(e) => set('expectedWeight', e.target.value)} invalid={!!errors.expectedWeight} />
          </Field>
        </Section>

        <Section title="Dates">
          <Field label="Order date" htmlFor="orderDate" error={errors.orderDate}>
            <Input id="orderDate" type="date" value={f.orderDate} onChange={(e) => set('orderDate', e.target.value)} invalid={!!errors.orderDate} />
          </Field>
          <Field label="Promised delivery date" htmlFor="deliveryDate" error={errors.deliveryDate}>
            <Input id="deliveryDate" type="date" value={f.deliveryDate} min={f.orderDate} onChange={(e) => set('deliveryDate', e.target.value)} invalid={!!errors.deliveryDate} />
          </Field>
        </Section>

        <Section title="Payment" hint="Rupee amounts only. Gold weights are tracked separately in the gold record.">
          <Field label="Estimated making charges" htmlFor="makingCharges" error={errors.makingCharges}>
            <MoneyInput id="makingCharges" value={f.makingCharges} onChange={(e) => set('makingCharges', e.target.value)} invalid={!!errors.makingCharges} />
          </Field>
          <Field
            label="Estimated total bill"
            htmlFor="estimatedTotal"
            error={errors.estimatedTotal}
            optional
            hint="Include gold value if the customer is paying for gold. Leave blank to use making charges."
          >
            <MoneyInput id="estimatedTotal" value={f.estimatedTotal} onChange={(e) => set('estimatedTotal', e.target.value)} invalid={!!errors.estimatedTotal} placeholder={making.ok && making.value ? String(making.value) : '0'} />
          </Field>
          <Field label="Advance received" htmlFor="advance" error={errors.advance}>
            <MoneyInput id="advance" value={f.advance} onChange={(e) => set('advance', e.target.value)} invalid={!!errors.advance} />
          </Field>
          <div className="flex items-end">
            {remainingPreview !== null && (
              <div className="w-full rounded-xl bg-sunken px-4 py-3 text-sm">
                <span className="text-ink-3">Remaining after advance: </span>
                <span className={`num font-semibold ${remainingPreview < 0 ? 'text-bad' : 'text-ink'}`}>{formatINR(remainingPreview)}</span>
              </div>
            )}
          </div>
        </Section>

        <Section title="Design">
          <Field label="Design description" htmlFor="description" className="sm:col-span-2" hint="Size, style, stones, finish — whatever the karigar needs to know.">
            <Textarea id="description" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Ladies ring with floral top, small red stone. Ring size 14." />
          </Field>
          <div className="sm:col-span-2">
            <span className="label">
              Design photo <span className="font-normal text-ink-4">(optional)</span>
            </span>
            {f.designImage ? (
              <div className="flex items-start gap-4">
                <img src={f.designImage} alt="Design reference" className="h-32 w-32 rounded-xl border border-line object-cover" />
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    Replace photo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => set('designImage', undefined)} className="text-bad">
                    <Trash2 size={14} /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busyImage}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-[#FCFAF6] px-4 py-6 text-sm text-ink-3 hover:border-gold-300 hover:text-ink"
              >
                <ImagePlus size={22} />
                {busyImage ? 'Processing photo…' : 'Add a photo or sketch'}
                <span className="text-xs text-ink-4">Stored on this device only, resized to save space</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} data-testid="design-image-input" />
          </div>
        </Section>
      </div>

      <div className="sticky bottom-[64px] z-20 -mx-4 mt-5 flex justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 lg:bottom-0">
        <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1 sm:flex-none">
          {editing ? 'Save changes' : 'Create order'}
        </Button>
      </div>
    </form>
  );
}
