---
title: "Evals used to test the solution"
subtitle: "KarigarSetu · results from runs on 20 Nov 2026"
---

# Summary

| Eval | What it checks | How it ran | Result |
|---|---|---|---|
| Unit tests (34) | Gold formula, tolerance rule, balances per purity, payments, input validation, workflow rules, demo-data consistency, CSV | Vitest, `npm test` | **34 / 34 passed** |
| End-to-end scenarios (38 checks) | The 7 scenarios from the brief, clicked through the real app in a browser | Playwright + Chromium, `npm run e2e` | **38 / 38 passed, 3 runs in a row** |
| Layout check | No sideways scrolling on any page at phone (390 px) and desktop (1366 px) widths | Playwright screenshots of 7 pages | **No overflow, no page errors** |
| Hosted-build smoke test | The single-file version used on Claude opens, navigates and shows the gold flag | Chromium on the built file | **Passed** |
| User testing with shop owners | Whether real jewellers can use it and trust it | Not done yet. Plan with blank result fields below | **Not run** |

Every result above comes from a test that was actually run. No user research, feedback or adoption numbers were collected or invented.

# 1. Unit tests — the gold calculation and rules

The core rule: **Unaccounted weight = Gold issued − Finished metal − Scrap returned − Approved process loss.** It is calculated in whole milligrams so that decimal rounding errors cannot appear. A difference is flagged only if it is **strictly greater** than the tolerance the owner sets (default 0.100 g).

| Area | Test | Result |
|---|---|---|
| Formula | 20.000 − 19.500 − 0.300 − 0.100 = exactly 0.100 g | Pass |
| Formula | No floating-point drift (e.g. 0.3 − 0.1 − 0.1 − 0.1 = 0) | Pass |
| Formula | Negative result when more comes back than was issued | Pass |
| Tolerance | Flags only differences strictly greater than tolerance (0.100 not flagged, 0.101 flagged) | Pass |
| Reconciliation | One order reconciled from its ledger entries | Pass |
| Reconciliation | Return beyond tolerance is flagged | Pass |
| Reconciliation | Purities kept separate; voided entries ignored | Pass |
| Balances | Karigar balance adds up all their jobs, per purity | Pass |
| Balances | Shop total never mixes 22K and 18K | Pass |
| Balances | Zero balances hidden; running balance follows date order | Pass |
| Payments | Remaining amount in rupees, separate from gold | Pass |
| Validation | Weights: up to 3 decimals; rejects negatives, text, 4+ decimals, zero where not allowed | Pass |
| Validation | Rupee amounts and 10-digit mobile numbers | Pass |
| Formatting | ₹2,15,000 Indian grouping; grams always shown as 0.000 g | Pass |
| Workflow | Sequential order IDs; invalid orders rejected | Pass |
| Workflow | Difference above tolerance needs a note before it can be closed | Pass |
| Workflow | Accepting a difference adds a visible adjustment; earlier entries unchanged | Pass |
| Workflow | Multiple jobs for one karigar add up correctly | Pass |
| Workflow | Cannot reassign an order while gold is still with the old karigar | Pass |
| Workflow | Voided entry stays visible but leaves the balance | Pass |
| Workflow | Zero, negative and over-precise gold weights rejected | Pass |
| Demo data | 4 karigars, 10 orders, mixed statuses, categories and purities | Pass |
| Demo data | Exactly one deliberate discrepancy (KS-1003, 0.700 g) | Pass |
| Demo data | Overdue, ready, stalled and pending-reconciliation alerts all present | Pass |
| Demo data | Gold with karigars: 18K 21.700 g and 22K 1.250 g, consistent | Pass |
| Filters & CSV | Status, karigar, due-date, name and phone filters; CSV includes every entry | Pass |

# 2. End-to-end scenarios — the 7 tests from the brief

Each run starts from a cleared browser, so the demo data loads fresh. The script then uses the app the way a person would: filling forms and clicking buttons.

| Scenario | Check | Result |
|---|---|---|
| **1. New order** | Order created with automatic ID KS-1011 | Pass |
| | Order detail page opens | Pass |
| | Appears in dashboard "Recent orders" | Pass |
| | "Active orders" card goes from 8 to 9 | Pass |
| | Appears on the Orders page | Pass |
| **2. Gold issue** | Ramesh Soni's 22K balance before: 0.050 g | Pass |
| | Karigar assigned on the order | Pass |
| | After issuing 20.000 g of 22K: 20.050 g | Pass |
| | His 18K balance (16.500 g) unchanged and shown separately | Pass |
| **3. Reconciliation** (19.500 finished, 0.300 scrap, 0.100 loss) | Live calculation in the form shows 0.100 g | Pass |
| | Order page shows Unaccounted weight 0.100 g | Pass |
| | Shown as within the 0.100 g tolerance (not flagged) | Pass |
| | Weights displayed exactly as entered | Pass |
| **4. Discrepancy alert** (10 g issued; 9.500 / 0.100 / 0.100 returned) | Unaccounted 0.300 g | Pass |
| | "Difference found" badge on the order | Pass |
| | Red "next step" panel explains the difference | Pass |
| | Listed under "Attention required" on the dashboard | Pass |
| | Tolerance raised to 0.500 g: no longer flagged | Pass |
| | Tolerance back to 0.100 g: flagged again | Pass |
| **5. Multiple jobs** | Ramesh's total: 22K 0.450 g, 18K 16.500 g | Pass |
| | His profile lists all 5 of his orders | Pass |
| | Each order keeps its own figure (0.100 g and 0.300 g) | Pass |
| **6. Persistence** | After browser refresh, order and gold record intact | Pass |
| | Ledger has 35 entries (27 demo + 8 new) | Pass |
| | Record visible in a newly opened tab | Pass |
| **7. Filters & export** | Status "Ready" shows only KS-1004 | Pass |
| | "Not assigned" shows only KS-1010 | Pass |
| | "Overdue" shows only KS-1005 | Pass |
| | Search "Test Customer" finds the two new orders | Pass |
| | Combined filters (Ramesh + active) correct | Pass |
| | Filters kept after refresh | Pass |
| | Full CSV export: 35 rows plus header | Pass |
| | CSV column headings correct | Pass |
| | New order's rows exported with exact weights | Pass |
| | Voided entry exported and marked as voided | Pass |
| | Filtered export (Ramesh, Gold Issued): 6 rows, same as on screen | Pass |
| **Runtime** | No errors in the browser during the whole run | Pass |

# 3. What the evals caught

Running the evals found three problems, all fixed before the results above:

1. **A crash when a pop-up form closed.** A React effect returned the wrong value. Caught by the "no browser errors" check.
2. **Typing could land in the wrong box.** The pop-up's automatic focus sometimes fired after the user had started typing, so a weight went into the first field. Caught because a scenario failed intermittently; the e2e suite was then run repeatedly until it passed every time.
3. **Hosting on Claude.** Claude's viewer blocks page-started downloads and path-style links. The CSV and backup exports were changed to use the viewer's save prompt, and the hosted version keeps its current page in memory.

# 4. Limits of these evals

- They prove the app does what was specified. They do not prove that shop owners want it or can use it.
- The browser scenarios ran at desktop size. Phone layouts were checked through screenshots, not clicked through.
- Downloads inside the hosted Claude version depend on the viewer's save prompt, which the automated tests cannot reach.

# 5. Next: test with real users (fill in after sessions)

| Task given to a shop owner | Completed? (Y / with help / N) | Time | Problems seen | What they said |
|---|---|---|---|---|
| Add a new customer order | | | | |
| Assign a karigar and record 20 g of 22K gold given | | | | |
| Record the returned piece, scrap and agreed loss; is anything missing? | | | | |
| Find how much gold a karigar holds right now | | | | |
| Find all late orders | | | | |
| Export the gold ledger | | | | |

| Question | Answer |
|---|---|
| Can they explain "unaccounted weight" in their own words? | |
| What tolerance would they set, and why? | |
| Would they stop using the paper register? What would stop them? | |
| Which language would they prefer? | |

*How to re-run:* `npm test` for unit tests. For the browser scenarios, run `npm run build && npm run preview`, then `npm run e2e` in a second terminal. Code: https://github.com/TanishqSaraf/KarigarSetu
