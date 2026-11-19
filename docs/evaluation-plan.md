# KarigarSetu — Evaluation plan

This document has two parts:

1. **Functional verification.** The 7 scenarios from the brief. These were run automatically by the developer; how to re-run them is below.
2. **User evaluation.** The same scenarios plus open questions, to run with real shop owners. **The result fields are intentionally blank.** No user testing has been done yet.

---

## Part 1 — Functional verification (automated)

| How | Command |
|---|---|
| Unit tests (calculations, validation, operations, demo-data consistency) | `npm test` |
| End-to-end browser scenarios (Chromium via Playwright, desktop viewport) | `npm run build && npm run preview` then, in another terminal, `npm run e2e` |

The e2e script (`e2e/scenarios.cjs`) starts from cleared storage, so the demo data loads fresh. It drives the real UI and writes `e2e/output/results.json` plus the exported CSV files.

| # | Scenario | Pass criteria checked by the script |
|---|---|---|
| 1 | **New order.** Create a customer order. | Gets auto ID `KS-1011`; detail page opens; appears in dashboard "Recent orders"; "Active orders" count goes up by 1; listed on Orders page. |
| 2 | **Gold issue.** Assign karigar, issue 20.000 g of 22K. | Ramesh Soni's 22K balance goes 0.050 → 20.050 g; his 18K balance is unchanged and shown separately. |
| 3 | **Reconciliation.** Return 19.500 finished, 0.300 scrap, 0.100 approved loss. | Live preview in the dialog and the order page both show **Unaccounted 0.100 g**; marked within the 0.100 g tolerance; entered weights shown exactly. |
| 4 | **Discrepancy alert.** Issue 10 g; return 9.500 / 0.100 / 0.100. | Unaccounted 0.300 g; "Difference found" badge; red next-step panel; listed under "Attention required". Raising tolerance to 0.500 g clears the flag; restoring 0.100 g brings it back. |
| 5 | **Multiple jobs.** Same karigar on several orders. | Ramesh's aggregate shows 22K 0.450 g and 18K 16.500 g; his profile lists all 5 of his orders; each order keeps its own figure (0.100 g, 0.300 g). |
| 6 | **Persistence.** Refresh the browser. | Order and gold records intact after reload; ledger shows 35 entries; record visible in a new tab. |
| 7 | **Filters & export.** | Status, karigar, "not assigned", overdue and text-search filters each return the expected orders; filters survive reload (kept in URL). Full CSV export has 35 rows with correct header, exact weights and the voided entry marked. Filtered export (Ramesh + Gold Issued) row count equals rows shown on screen, and every row matches the filter. |

---

## Part 2 — User evaluation (to be filled in)

### Session setup

| Field | Value |
|---|---|
| Date | |
| Facilitator | |
| Participant ID (no names) | |
| Shop type / town size | |
| Number of karigars they work with | |
| Current method (register / WhatsApp / software / other) | |
| Device used (phone model / laptop) | |
| Language preference | |
| Consent recorded (Y/N) | |

### Tasks

For each task, record: completed without help? (Y / with help / N), time taken, errors made, and what the participant said.

| # | Task given to participant | Completed? | Time | Errors / hesitations | Quotes & observations |
|---|---|---|---|---|---|
| 1 | "A customer just ordered a 22K ring. Add the order." | | | | |
| 2 | "Give this job to a karigar and record that you gave them 20 grams of 22K gold." | | | | |
| 3 | "The karigar returned the ring: 19.5 g finished, 0.3 g scrap, and you agreed 0.1 g loss. Record it. Is everything accounted for?" | | | | |
| 4 | "Another karigar returned less than expected. Find out how much is missing and what you would do." | | | | |
| 5 | "How much gold is Ramesh holding right now? Is any of it 18K?" | | | | |
| 6 | "Close the app, open it again. Is your work still there?" | | | | |
| 7 | "Find all orders that are late. Then download the gold ledger for your accountant." | | | | |

### Comprehension checks

| Question | Participant's answer | Correct? |
|---|---|---|
| In your own words, what does "Unaccounted weight" mean? | | |
| What does the tolerance setting do? What value would you set? | | |
| Why are 22K and 18K shown separately? | | |
| What happens if you make a typing mistake in a gold entry? | | |

### Open questions to explore

| Question | Notes |
|---|---|
| How do they handle karigar wastage today? Fixed %, per job, negotiated? | |
| Do they give karigars fine gold, 22K, or old jewellery to melt? | |
| Do karigars return stones separately, and do they weigh them? | |
| Who would enter data, and when (at the counter, end of day)? | |
| Would they trust data that lives only on one phone? | |
| Which language(s) would they prefer? | |
| What would make them stop using their paper register? | |
| What is missing that would stop them from using this? | |

### Post-session ratings (participant's own words preferred over scores)

| Item | Response |
|---|---|
| Ease of use (1–5) | |
| Trust in the gold calculation (1–5) | |
| Likelihood to use for next order (1–5) | |
| Biggest problem | |
| Most useful part | |

### Summary across sessions

| Field | Value |
|---|---|
| Number of participants | |
| Task success rate per task | |
| Recurring usability issues | |
| Assumptions confirmed | |
| Assumptions disproven | |
| Changes to make next | |
