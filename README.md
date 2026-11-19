# KarigarSetu

Job-work and gold tracking for small Indian jewellers who outsource manufacturing to karigars (goldsmiths).

It tracks three things:
1. **Orders.** What the customer asked for, and when it is due.
2. **Karigars.** Who is working on which order, and where each order stands.
3. **Gold accountability.** Gold issued vs. finished metal + scrap + approved loss returned, with any unexplained difference flagged against a tolerance you set.

The MVP runs entirely in the browser (React + TypeScript + Tailwind, data in `localStorage`). There is no server and no login. It opens with **illustrative demo data** for a fictional shop; reset or clear it in **Settings → Your data**.

## Run locally

Requires Node 18+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

Production build and preview:

```bash
npm run build
```

```bash
npm run preview
```

Open http://localhost:4173.

## Tests

Unit tests (calculations, validation, data operations, demo-data consistency):

```bash
npm test
```

End-to-end scenarios through the real UI. Needs Playwright with Chromium available to Node, and the preview server running on port 4173:

```bash
npm run e2e
```

## Project layout

```
src/
  lib/            pure logic, no React
    types.ts          data model
    calculations.ts   reconciliation formula, balances per purity, payments (tested)
    orders.ts         statuses, overdue/due-soon/stale rules, attention alerts, filters
    validation.ts     weight / amount / phone parsing
    csv.ts            ledger CSV export
  store/
    operations.ts     every data change as a pure function (append-only ledger)
    storage.ts        localStorage load/save, backup validation
    StoreProvider.tsx React context, persistence, toasts
  data/demo.ts      demo shop, built by replaying real operations
  components/     UI primitives, order list, ledger table, workflow dialogs
  pages/          Dashboard, Orders, Order form, Order detail, Karigars, Karigar detail, Gold Ledger, Settings
docs/
  product-assumptions.md
  evaluation-plan.md
e2e/scenarios.cjs   browser checks for the 7 evaluation scenarios
```

## Key rules

- `Unaccounted = Gold issued − Finished metal − Scrap returned − Approved process loss`, computed in whole milligrams.
- A difference is flagged only when it is strictly greater than the tolerance in Settings (default 0.100 g).
- Ledger entries are never edited or deleted. Mistakes are voided (still visible, with a reason) or corrected with an explicit adjustment.
- Gold balances are always shown per purity; 22K and 18K are never added together.
