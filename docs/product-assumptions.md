# KarigarSetu — Product assumptions

These are working assumptions made while building the MVP. None of them has been validated with real jewellers yet. They are hypotheses to test, not findings.

## The problem

- **Hypothesis:** Small independent jewellers who outsource manufacturing to karigars track orders, gold issued and gold returned across paper registers, memory and WhatsApp. That makes it hard to know (a) where each order stands and (b) whether all gold handed out has been accounted for.
- We do not know how common this is, how much gold goes unaccounted in practice, or whether owners see it as a problem worth paying to solve. No interviews, surveys or usage data informed this build.

## Users

- The primary user is the shop owner (or one trusted family member/staff), not the karigar. Karigars do not log in or update anything themselves.
- The owner is comfortable with WhatsApp and a smartphone, but not necessarily with business software. Hence plain-English labels, short forms, one obvious "Next step" per order, and no accounting terms like "debit/credit".
- Phone first, but some owners will use a desktop or laptop at the counter.
- English UI only for now. Hindi and regional languages are likely needed for real users. Not built.

## Gold accounting model

- **One formula, shown in full:** `Unaccounted = Gold issued − Finished metal (excl. stones) − Scrap returned − Approved process loss`. Positive = gold still unexplained with the karigar; negative = more came back than was issued.
- **Tolerance is the owner's choice.** It is an absolute weight in grams (default **0.100 g**, editable in Settings), meant to cover normal weighing variation. A difference is flagged only when it is **strictly greater** than the tolerance. The app does **not** assume any industry-standard wastage percentage.
- **Approved process loss is agreed per job** by the owner and karigar, and entered by the owner. It is not computed.
- **Weights are never silently changed.** Ledger entries are append-only. A mistake is corrected by *voiding* the entry (it stays visible, crossed out, with a reason) and entering the right one, or by recording an explicit *Adjustment*.
- **Closing a reconciliation** with a remaining difference requires the owner to choose between:
  - keeping it on the karigar's balance (they still owe it), or
  - accepting it as additional loss, which writes a visible Adjustment entry.
  If the difference is above tolerance, a note is mandatory.
- **Purities are never mixed.** Every balance (per order, per karigar, shop total) is kept separately per purity label (22K, 18K, or an owner-entered value like 14K). Purity labels are normalised (`22k` → `22K`).
- **Karigar balance** = everything issued − everything returned − approved/accepted losses ± manual adjustments, across all of that karigar's orders. It includes unexplained differences that haven't been settled, because that gold is genuinely still unaccounted for.
- Gold is issued against an order. Manual adjustments can optionally be unlinked from an order.
- Fine-gold (24K-equivalent) conversion, touch/tunch testing and alloy calculations are **out of scope**. 22K and 18K weights are tracked as-is.
- The ledger assumes the shop issues **its own gold**. Customer-supplied old gold, exchange gold and stone weights are not modelled separately. For repairs, the customer's item weight can be noted in "expected weight" and the description.
- Only gold metals (yellow/white/rose) are offered. Silver and platinum are not supported.
- Weights are stored in grams, entered with up to 3 decimals (milligrams). All arithmetic is done in whole milligrams to avoid floating-point drift.

## Orders and workflow

- Order lifecycle: New → Karigar assigned → Gold issued → Work in progress → Item received → (gold reconciled) → Ready for delivery → Delivered. "Cancelled" is also available.
- Workflow buttons move the status forward automatically. The owner can also set any status manually; a warning is shown if gold isn't reconciled yet.
- One karigar per order at a time. Reassignment is blocked while gold for that order is still with the previous karigar.
- Multiple gold issues and multiple returns per order are allowed (e.g. extra gold needed, or scrap brought back later).
- "Due soon" = delivery within N days (default 3). "No update from karigar" = a job with the karigar with no timeline activity for N days (default 7). Both are configurable.
- Order IDs are sequential (`KS-1001`, `KS-1002`, …). Ledger transaction IDs are `GT-0001`, ….

## Money

- Money is tracked only as estimates and receipts: making charges, estimated total bill (optionally including gold value), advance, later payments, and remaining. Gold weights and rupees are displayed separately and never converted into each other.
- No gold-rate lookup, invoicing, GST or accounting. INR is the only currency.

## Data and privacy

- All data lives in the browser's `localStorage` on one device. There is no server, no login and no sync. Clearing browser data deletes everything, so the app offers JSON backup and restore.
- Design photos are compressed on-device (max 1000 px JPEG) to fit within browser storage limits (~5 MB per site in most browsers).
- The demo data (a fictional shop, "Shree Laxmi Jewellers", with 4 karigars and 10 orders) is generated relative to today's date so that overdue and due-soon examples stay meaningful. All names and phone numbers are made up. It contains one deliberate discrepancy (KS-1003, 0.700 g) and one voided typo entry (KS-1005).

## Explicitly out of scope for this MVP

Live gold rates, buying/selling, payments processing, GST, accounting, AI design, blockchain, multi-user roles and permissions, karigar-facing app, notifications/SMS/WhatsApp integration, multi-device sync.
