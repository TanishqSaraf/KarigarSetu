import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { exceedsTolerance, toMg } from '../lib/calculations';
import { cn } from '../lib/cn';
import { formatGrams, formatGramsValue } from '../lib/format';

export interface MathLine {
  purity: string;
  issued: number;
  finished: number;
  scrap: number;
  approvedLoss: number;
  otherAdjustments: number;
  unaccounted: number;
}

/** The reconciliation formula written out line by line, like a register entry. */
export function ReconciliationMath({ line, tolerance, compact }: { line: MathLine; tolerance: number; compact?: boolean }) {
  const over = exceedsTolerance(line.unaccounted, tolerance);
  const zero = toMg(line.unaccounted) === 0;
  const Row = ({ label, value, sign, muted }: { label: string; value: number; sign: '' | '−' | '+'; muted?: boolean }) => (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', muted && 'text-ink-3')}>
      <span className="text-sm text-ink-2">{label}</span>
      <span className="weight text-[15px]">
        <span className="mr-1.5 inline-block w-3 text-center text-ink-3">{sign}</span>
        {formatGramsValue(value)}
        <span className="ml-0.5 font-sans text-xs text-ink-3">g</span>
      </span>
    </div>
  );
  return (
    <div className={cn('rounded-xl border border-line bg-[#FCFAF6]', compact ? 'px-3.5 py-2' : 'px-4 py-3')} data-testid={`recon-math-${line.purity}`}>
      <div className="flex items-center justify-between pb-1">
        <span className="rounded-md bg-gold-50 px-1.5 py-0.5 text-xs font-semibold text-gold-700 ring-1 ring-inset ring-gold-200">{line.purity} gold</span>
      </div>
      <Row label="Gold issued" value={line.issued} sign="" />
      <Row label="Finished metal (excl. stones)" value={line.finished} sign="−" />
      <Row label="Scrap returned" value={line.scrap} sign="−" />
      <Row label="Approved process loss" value={line.approvedLoss} sign="−" />
      {line.otherAdjustments !== 0 && (
        <Row label="Other adjustments" value={Math.abs(line.otherAdjustments)} sign={line.otherAdjustments > 0 ? '+' : '−'} muted />
      )}
      <div
        className={cn(
          '-mx-1 mt-1.5 flex items-center justify-between gap-3 rounded-lg border-t px-1 pt-2.5',
          over ? 'border-bad-line' : 'border-line-strong',
        )}
      >
        <span className={cn('text-sm font-semibold', over ? 'text-bad' : 'text-ink')}>
          {line.unaccounted < 0 ? 'Extra returned' : 'Unaccounted weight'}
        </span>
        <span className={cn('weight text-lg font-semibold', over ? 'text-bad' : zero ? 'text-ok' : 'text-ink')} data-testid="unaccounted-value">
          {formatGrams(Math.abs(line.unaccounted))}
        </span>
      </div>
      <div className={cn('mt-2 flex items-start gap-1.5 text-[13px]', over ? 'text-bad' : 'text-ok')}>
        {over ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
        <span>
          {zero
            ? 'Fully accounted for.'
            : over
              ? `More than your tolerance of ${formatGrams(tolerance)}. Check with the karigar before closing.`
              : `Within your tolerance of ${formatGrams(tolerance)}.`}
        </span>
      </div>
    </div>
  );
}

export const RECON_EXPLAINER = (
  <>
    <strong className="font-semibold">How the gold check works</strong>
    <br />
    Unaccounted = Gold issued − Finished metal − Scrap returned − Approved process loss.
    <br />
    <br />
    Weigh the finished piece without stones. A small difference within your tolerance (set in Settings) is normal weighing variation. Anything above it is flagged so you can ask the karigar.
  </>
);
