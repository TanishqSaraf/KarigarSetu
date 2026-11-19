import { Info, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../lib/cn';

// ---------- Buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 active:bg-black disabled:bg-ink-4',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken active:bg-line disabled:text-ink-4',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink active:bg-line disabled:text-ink-4',
  danger: 'bg-bad text-white hover:bg-[#962820] disabled:opacity-50',
  gold: 'bg-gold-100 text-gold-700 border border-gold-200 hover:bg-gold-200 disabled:opacity-50',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export const btnClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ variant = 'primary', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={btnClass(variant, size, className)} {...rest} />
  ),
);
Button.displayName = 'Button';

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

// ---------- Layout bits ----------

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-ink-3">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 sm:mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'gold';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 border-line',
  ok: 'bg-ok-bg text-ok border-ok-line',
  warn: 'bg-warn-bg text-warn border-warn-line',
  bad: 'bg-bad-bg text-bad border-bad-line',
  info: 'bg-info-bg text-info border-info-line',
  gold: 'bg-gold-50 text-gold-700 border-gold-200',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-ink-3">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tap/hover explainer. Works on touch screens (tap to open, tap outside to close). */
export function InfoTip({ children, label = 'More information', className }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);
  return (
    <span ref={ref} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-full p-0.5 text-ink-4 hover:text-ink-2"
      >
        <Info size={15} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1.5 w-64 -translate-x-1/2 rounded-xl border border-line bg-ink px-3 py-2.5 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-white shadow-pop sm:w-72"
        >
          {children}
        </span>
      )}
    </span>
  );
}

// ---------- Form fields ----------

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
  optional?: boolean;
}

export function Field({ label, hint, error, htmlFor, className, children, optional }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-4">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[13px] text-ink-3">{hint}</p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: string; suffix?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, prefix, suffix, ...rest }, ref) => {
  if (!prefix && !suffix) return <input ref={ref} className={cn('input', invalid && 'input-error', className)} aria-invalid={invalid || undefined} {...rest} />;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-3">{prefix}</span>}
      <input
        ref={ref}
        className={cn('input', prefix && 'pl-8', suffix && 'pr-10', invalid && 'input-error', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-3">{suffix}</span>}
    </div>
  );
});
Input.displayName = 'Input';

/** Text input tuned for grams: decimal keypad on phones, monospaced digits, "g" suffix. */
export const WeightInput = forwardRef<HTMLInputElement, Omit<InputProps, 'suffix' | 'type'>>(({ className, ...rest }, ref) => (
  <Input ref={ref} type="text" inputMode="decimal" autoComplete="off" placeholder="0.000" suffix="g" className={cn('weight', className)} {...rest} />
));
WeightInput.displayName = 'WeightInput';

export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputProps, 'prefix' | 'type'>>(({ className, ...rest }, ref) => (
  <Input ref={ref} type="text" inputMode="decimal" autoComplete="off" placeholder="0" prefix="₹" className={cn('num', className)} {...rest} />
));
MoneyInput.displayName = 'MoneyInput';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        'input appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%237A736A%22%20stroke-width%3D%222%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        invalid && 'input-error',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cn('input min-h-[84px] resize-y leading-relaxed', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

/** Segmented choice — better than a dropdown when there are 2–5 options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  name: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
              active ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:bg-sunken',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Modal (bottom sheet on phones, dialog on desktop) ----------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open/focus effect on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      if (panel.current?.contains(document.activeElement)) return; // user is already typing
      const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea, [data-autofocus]');
      (first ?? panel.current)?.focus();
    }, 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-pop outline-none sm:max-h-[88vh] sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[15px] leading-relaxed text-ink-2">{body}</div>
    </Modal>
  );
}

// ---------- Small display helpers ----------

export function KeyValue({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] text-ink">{value}</dd>
    </div>
  );
}
