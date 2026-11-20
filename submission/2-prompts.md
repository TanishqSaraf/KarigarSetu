---
title: "Prompts used to create the tool"
subtitle: "KarigarSetu · built with Claude Code"
---

**Tool used:** Claude Code (Anthropic), in a cloud session. Claude wrote, ran and tested the code from these prompts. The prompts are listed in the order they were sent, word for word.

| # | Purpose | Prompt |
|---|---|---|
| 1 | Build the full app | The main specification, reproduced in full below |
| 2 | Save the code to GitHub | "commit and push to my github repo" |
| 3 | Give the repository to push to | "https://github.com/TanishqSaraf/KarigarSetu.git here is the link" |
| 4 | Retry after granting GitHub access | "connected now. push again" |
| 5 | Host the app and get a link | "As said in this document, i can host it on claude itself. Can you host it? and give me a shareable link" (sent with a screenshot of the assignment brief) |
| 6 | Prepare submission files | "give the top 3 things mentioned here to me that i can download" (sent with a screenshot of the list of artifacts to submit) |

When prompt 2 was sent, Claude asked where to push, because no matching repository existed. The answer chosen was: *"New repo — I'll create it"*.

# Prompt 1 — main build specification (verbatim)

```text
Build KarigarSetu — A Job-Work Management App for Small Indian Jewellers
Act as a senior product designer and full-stack engineer. Build a polished, fully functional, mobile-first web application called KarigarSetu.
Do not just create a UI mockup. Build a working MVP with functional interactions, data persistence, realistic demo data, and a clean user experience.
1. PRODUCT CONTEXT
KarigarSetu is designed for small, independent jewellery shop owners in India who work with external goldsmiths (karigars).
Many small jewellery businesses manage customer orders, karigar assignments, gold issued for manufacturing, finished products and payments through physical registers, memory and WhatsApp conversations.
This creates an important operational challenge: shop owners need to keep track of both the progress of an order and the gold entrusted to different karigars.
The app should solve this specific problem:
How might we help a small jewellery shop owner track outsourced jewellery work and reconcile gold issued to and received back from karigars without maintaining complicated physical registers?
The primary user is a small-town jewellery shop owner who may not be highly comfortable with complex software.
Design for simplicity, trust and speed.
Do not assume this is a universal problem or invent research statistics. Treat the description as a product hypothesis.
2. CORE PRODUCT PRINCIPLE
The app should revolve around three things:

1. Orders: What has a customer requested, and when must it be delivered?
2. Karigar tracking: Who is working on which order, and what is its current status?
3. Gold accountability: How much gold was issued, how much finished material and scrap were returned, and is there any unexplained difference?

Avoid turning this into a full accounting, GST, inventory or ERP platform.
3. DESIGN AND TECHNOLOGY

* Build using React, TypeScript and Tailwind CSS.
* Use the existing project setup if one exists. Otherwise, initialise a suitable Vite + React + TypeScript project.
* Use Lucide icons.
* Use localStorage for persistent demo data.
* Make the experience mobile-first but also excellent on desktop.
* Use Indian currency formatting (₹) and grams (g).
* Use realistic fictional Indian names and jewellery-shop examples.
* No paid APIs or external services.
* No authentication required for this MVP.

Visual direction
The app should feel like a modern financial product, combining the simplicity of Groww with the familiarity of a traditional Indian jewellery business.
Use:

* Warm off-white backgrounds.
* Deep charcoal text.
* Muted gold accents.
* Subtle green for successful/completed states.
* Red or amber for important discrepancies and overdue orders.
* Clean typography and generous whitespace.
* Rounded cards, restrained shadows and clear visual hierarchy.

Avoid excessive gold gradients, ornamental jewellery graphics, unnecessary animations and generic AI-generated dashboard aesthetics.
The UI should feel trustworthy and professional.
4. APP STRUCTURE
Create a sidebar on desktop and a suitable mobile navigation system.
The main sections should be:

* Dashboard
* Orders
* Karigars
* Gold Ledger
* Settings

A. DASHBOARD
This is the shop owner's home screen.
Show the following summary cards:

* Active Orders
* Orders Due Soon
* Overdue Orders
* Gold Currently with Karigars
* Pending Reconciliation

Below these, include:
Recent Orders
A table containing order ID, customer, item, assigned karigar, delivery date, gold issued and current status.
Karigar Overview
Show each karigar, their active jobs and the total gold currently issued to them.
Attention Required
Show important notifications such as:

* Order delivery date has passed.
* Gold received back does not reconcile with the issued material.
* Customer order is ready but not delivered.
* Karigar has not updated a pending job.

Add a prominent button: "+ New Order".
Clicking any order should open its detailed page.
B. ORDERS
Create a complete order-management section.
Users should be able to:

* Create an order.
* Edit an existing order.
* Search orders.
* Filter by status, karigar and delivery date.
* View order details.
* Update order status.

The new-order form should contain:

* Customer name
* Customer phone number
* Order type: Custom / Repair
* Jewellery category: Ring / Necklace / Bracelet / Earrings / Other
* Metal type
* Purity: 22K / 18K / Other
* Expected finished weight
* Customer order date
* Expected delivery date
* Advance received
* Estimated making charges
* Design description
* Optional design image upload

Each order should receive a unique order ID automatically.
C. ORDER DETAILS PAGE
This is one of the most important pages.
Display:
Order information
Customer details, jewellery type, design, purity, weight, delivery date and payment information.
Karigar assignment
Allow the shop owner to assign the order to a karigar, record the assignment date and add an expected completion date.
Gold issue record
Allow the owner to record:

* Karigar name
* Gold purity
* Gold weight issued (grams)
* Date of issue
* Notes

Gold return record
When a karigar returns the jewellery, allow the owner to record:

* Finished metal weight (excluding stones)
* Scrap gold returned
* Approved process loss / wastage
* Date received
* Notes

The app must automatically calculate:
Unaccounted Weight = Gold Issued - Finished Metal Weight - Scrap Returned - Approved Process Loss
Display this calculation clearly.
Do not hardcode a universal acceptable wastage percentage. Allow the shop owner to configure a tolerance in Settings. Only flag an unexplained difference when it exceeds that configured threshold.
Do not silently change or adjust a recorded gold weight.
Order timeline
Show a chronological timeline of events:

* Order created
* Karigar assigned
* Gold issued
* Work started
* Finished item received
* Reconciliation completed
* Ready for delivery
* Delivered

Allow the user to add notes to important events.
Order payment section
Track:

* Total estimated amount
* Advance received
* Remaining amount

These figures should be clearly distinguished from actual gold weights.
D. KARIGARS
Create a page to manage artisans.
Each karigar profile should contain:

* Name
* Phone number
* Specialisation
* Current active jobs
* Total gold currently issued
* Completed jobs
* Pending jobs

Opening a karigar profile should show their assigned orders and gold ledger history.
Allow the owner to add, edit and archive a karigar.
E. GOLD LEDGER
This should be a central feature of the product.
Create a ledger showing all gold movement between the shop and its karigars.
Columns:

* Date
* Transaction ID
* Karigar
* Order ID
* Transaction type (Gold Issued / Finished Gold Returned / Scrap Returned / Adjustment)
* Purity
* Weight (grams)

Include:

* Search and filters.
* A karigar-wise gold balance.
* A total outstanding gold balance.
* Clear visual indication of unreconciled transactions.

Allow export to CSV.
Important: Never mix different gold purities into one unqualified weight balance. Show balances separately by purity.
F. SETTINGS
Keep this section simple.
Include:

* Shop name
* Shop contact information
* Configurable discrepancy tolerance (grams)
* Currency preference (default INR)
* Data export and reset options

Allow users to download a JSON backup of their data.
5. DEMO DATA
The app must not open as an empty dashboard.
Create realistic fictional demo data:

* One jewellery shop.
* Four fictional karigars.
* At least eight customer orders.
* A mix of completed, active, pending and overdue orders.
* Different jewellery categories.
* Different gold purities.
* Several gold issue and return records.
* At least one order with an unreconciled weight difference.
* At least one order ready for delivery.

Make the sample data internally consistent except for deliberately flagged discrepancies.
Add a "Reset Demo Data" option so I can restore the original demonstration state.
Make it obvious that the displayed data is illustrative.
6. IMPORTANT USER EXPERIENCE DETAILS
The intended user may be accustomed to a paper register rather than business software.
Therefore:

* Keep forms short and understandable.
* Use plain English rather than technical accounting terminology.
* Provide sensible defaults.
* Make primary actions easy to locate.
* Do not hide important information in menus.
* Use clear empty states.
* Show confirmation before deleting important records.
* Show success and error messages after actions.
* Validate all weight and payment inputs.
* Prevent negative weights.
* Make all tables usable on mobile.
* Ensure important information remains readable without horizontal scrolling.

Use grams consistently and allow up to three decimal places.
Include a few helpful labels or tooltips explaining how gold reconciliation works.
7. FUNCTIONAL REQUIREMENTS
All key interactions must genuinely work.
I should be able to:

1. Create a new customer order.
2. Add a new karigar.
3. Assign a karigar to an order.
4. Record gold issued to that karigar.
5. Update order status.
6. Record finished gold and scrap returned.
7. See the automatically calculated gold discrepancy.
8. See overdue orders.
9. Search and filter records.
10. View a karigar's outstanding gold balance.
11. Export the ledger.
12. Refresh the browser without losing saved data.

Use reusable components and clean TypeScript data models.
Make calculations a separate, testable part of the codebase. Avoid duplicating business logic across components.
8. EVALUATION AND TESTING
After building, test the following scenarios:
Test 1 — New order
Create a customer order and check whether it appears on the dashboard and orders page.
Test 2 — Gold issue
Assign a karigar and issue 20.000 grams of 22K gold. Check whether the karigar's outstanding gold balance increases.
Test 3 — Gold reconciliation
Record 19.500 grams of finished metal, 0.300 grams of scrap returned and 0.100 grams of approved process loss.
The unaccounted weight should be 0.100 grams.
Test 4 — Discrepancy alert
Record a return that produces a difference greater than the configured tolerance. The app should clearly flag it.
Test 5 — Multiple jobs
Assign multiple jobs to the same karigar. Check whether the individual job records and aggregate karigar balance are correct.
Test 6 — Persistence
Refresh the browser and check whether all created records remain intact.
Test 7 — Filters and exports
Check whether order filters work and whether the exported ledger contains the correct records.
Create automated tests for important calculations wherever practical.
Do not claim a test passed unless it was actually executed.
9. SCOPE LIMITATIONS
Do not implement:

* Live gold-rate integrations.
* Actual jewellery purchases or sales.
* Online payment processing.
* GST filing.
* Complex accounting.
* AI jewellery design generation.
* Blockchain or cryptocurrency.
* Complicated multi-user permissions.

These are outside the MVP.
10. FINAL INSTRUCTIONS
Think like a product builder, not just a developer.
First inspect the repository and understand the existing setup. Then implement the complete application.
Prioritise a polished dashboard, order detail page and gold reconciliation workflow.
Do not stop after creating a plan or describing the architecture. Write the code, run the application, fix errors and verify the key interactions.
When finished, provide:

1. A summary of the features implemented.
2. Instructions to run the app locally.
3. The exact tests executed and their results.
4. Any known limitations.

Also create a short `docs/product-assumptions.md` documenting the assumptions made during development and a `docs/evaluation-plan.md` containing the test scenarios and blank fields where real user-test results can be recorded.
Do not invent customer interviews, user feedback, validation results, adoption statistics or business outcomes.
```
