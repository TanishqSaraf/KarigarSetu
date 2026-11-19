// End-to-end checks for the 7 evaluation scenarios, driven through the real UI in Chromium.
// Usage: start the app (npm run build && npm run preview), then: npm run e2e
// Optional: BASE_URL=http://localhost:5173 npm run e2e
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let current = '';
function check(cond, msg) {
  results.push({ test: current, ok: !!cond, msg });
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${msg}`);
}
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const goto = async (p) => {
    await page.goto(BASE + p);
    await page.waitForLoadState('networkidle');
  };
  const dialog = () => page.getByRole('dialog');
  const karigarGold = async (id) => {
    await goto(`/karigars/${id}`);
    return text(page.locator('div.card', { hasText: 'Gold currently with' }).first());
  };
  const createOrder = async (name, weight) => {
    await goto('/orders/new');
    await page.fill('#customerName', name);
    await page.fill('#customerPhone', '9800012345');
    await page.getByRole('radio', { name: 'Ring', exact: true }).click();
    await page.fill('#expectedWeight', weight);
    await page.fill('#makingCharges', '5000');
    await page.fill('#advance', '1000');
    await page.getByRole('button', { name: 'Create order' }).click();
    await page.waitForURL(/\/orders\/KS-\d+$/);
    return page.url().split('/').pop();
  };
  const assignRamesh = async () => {
    await page.getByRole('button', { name: 'Assign karigar' }).first().click();
    await dialog().locator('label', { hasText: 'Ramesh Soni' }).click();
    await dialog().getByRole('button', { name: 'Save assignment' }).click();
    await dialog().waitFor({ state: 'detached' });
  };
  const issue = async (grams) => {
    await page.getByRole('button', { name: 'Issue gold' }).first().click();
    await page.fill('#ig-weight', grams);
    await dialog().getByRole('button', { name: 'Record gold issued' }).click();
    await dialog().waitFor({ state: 'detached' });
  };
  const receive = async (f, s, l) => {
    await page.getByRole('button', { name: 'Mark work started' }).click();
    await page.getByRole('button', { name: 'Record item received' }).first().click();
    await page.fill('#rc-finished', f);
    await page.fill('#rc-scrap', s);
    await page.fill('#rc-loss', l);
    const preview = await text(dialog().getByTestId('unaccounted-value'));
    await dialog().getByRole('button', { name: 'Save return' }).click();
    await dialog().waitFor({ state: 'detached' });
    return preview;
  };

  try {
    await goto('/');
    await page.evaluate(() => localStorage.clear());
    await goto('/');
    const activeBefore = Number(await text(page.locator('a', { hasText: 'Active orders' }).locator('.num').first()));

    // ---------- Test 1 ----------
    current = 'Test 1 — New order';
    console.log(current);
    const o1 = await createOrder('Test Customer Alpha', '19.5');
    check(o1 === 'KS-1011', `order created with auto ID ${o1}`);
    check(await page.getByRole('heading', { name: 'Test Customer Alpha' }).waitFor().then(() => true, () => false), 'order detail page opens');
    await goto('/');
    check((await text(page.locator('div.card', { hasText: 'Recent orders' }))).includes('Test Customer Alpha'), 'appears in dashboard Recent orders');
    const activeAfter = Number(await text(page.locator('a', { hasText: 'Active orders' }).locator('.num').first()));
    check(activeAfter === activeBefore + 1, `Active orders card ${activeBefore} → ${activeAfter}`);
    await goto('/orders');
    check(await page.locator('tbody tr', { hasText: 'Test Customer Alpha' }).count() === 1, 'appears on Orders page');

    // ---------- Test 2 ----------
    current = 'Test 2 — Gold issue';
    console.log(current);
    const before = await karigarGold('K-1');
    check(/22K\s*0\.050/.test(before), `Ramesh 22K balance before: ${before}`);
    await goto(`/orders/${o1}`);
    await assignRamesh();
    check((await text(page.locator('div.card', { hasText: 'Assigned on' }).first())).includes('Ramesh Soni'), 'karigar assigned on order');
    await issue('20.000');
    const after = await karigarGold('K-1');
    check(/22K\s*20\.050/.test(after), `Ramesh 22K balance after issuing 20.000 g: ${after}`);
    check(/18K\s*16\.500/.test(after), '18K balance unchanged and kept separate');

    // ---------- Test 3 ----------
    current = 'Test 3 — Gold reconciliation';
    console.log(current);
    await goto(`/orders/${o1}`);
    const live = await receive('19.500', '0.300', '0.100');
    check(live === '0.100 g', `live calculation in dialog shows ${live}`);
    const shown = await text(page.getByTestId('unaccounted-value'));
    check(shown === '0.100 g', `order page Unaccounted weight = ${shown}`);
    check(await page.getByText('Within your tolerance of 0.100 g.').isVisible(), 'shown as within 0.100 g tolerance (not flagged)');
    const issuedRow = await text(page.getByTestId('recon-math-22K'));
    check(/Gold issued 20\.000/.test(issuedRow) && /19\.500/.test(issuedRow) && /0\.300/.test(issuedRow), 'recorded weights displayed exactly as entered');

    // ---------- Test 4 ----------
    current = 'Test 4 — Discrepancy alert';
    console.log(current);
    const o2 = await createOrder('Test Customer Beta', '9.5');
    await assignRamesh();
    await issue('10');
    const live2 = await receive('9.500', '0.100', '0.100');
    check(live2 === '0.300 g', `unaccounted = ${live2} (tolerance 0.100 g)`);
    check(await page.getByText('Difference found').first().isVisible(), '"Difference found" badge on order');
    check((await text(page.getByTestId('next-step'))).includes('0.300 g of gold doesn’t add up'), 'next-step panel flags the difference');
    await goto('/');
    check((await text(page.locator('div.card', { hasText: 'Attention required' }))).includes(`Gold does not reconcile — ${o2}`), 'dashboard Attention lists the discrepancy');
    // Raising tolerance above the difference removes the flag; lowering restores it.
    await goto('/settings');
    await page.fill('#s-tol', '0.500');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await goto(`/orders/${o2}`);
    check(!(await page.getByText('Difference found').isVisible()), 'with tolerance 0.500 g the 0.300 g difference is no longer flagged');
    await goto('/settings');
    await page.fill('#s-tol', '0.100');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await goto(`/orders/${o2}`);
    check(await page.getByText('Difference found').first().isVisible(), 'tolerance back to 0.100 g → flagged again');

    // ---------- Test 5 ----------
    current = 'Test 5 — Multiple jobs';
    console.log(current);
    const agg = await karigarGold('K-1');
    // KS-1005 18K 16.500 · KS-1006 22K 0.050 · o1 22K 0.100 · o2 22K 0.300
    check(/22K\s*0\.450/.test(agg) && /18K\s*16\.500/.test(agg), `Ramesh aggregate balance: ${agg}`);
    await page.getByRole('radio', { name: 'All', exact: true }).click();
    const rows = await page.locator('div.card', { hasText: 'Assigned orders' }).locator('tbody tr').allInnerTexts();
    const ids = rows.map((r) => r.match(/KS-\d+/)[0]).sort();
    check(JSON.stringify(ids) === JSON.stringify(['KS-1002', 'KS-1005', 'KS-1006', o1, o2].sort()), `karigar profile lists all jobs: ${ids.join(', ')}`);
    await goto(`/orders/${o1}`);
    check((await text(page.getByTestId('unaccounted-value'))) === '0.100 g', `${o1} individual record still 0.100 g`);
    await goto(`/orders/${o2}`);
    check((await text(page.getByTestId('unaccounted-value'))) === '0.300 g', `${o2} individual record still 0.300 g`);

    // ---------- Test 6 ----------
    current = 'Test 6 — Persistence';
    console.log(current);
    await page.reload();
    await page.waitForLoadState('networkidle');
    check((await text(page.getByTestId('unaccounted-value'))) === '0.300 g', 'after reload: order and its gold record intact');
    await goto('/ledger');
    const count = await text(page.getByText(/of \d+ entries/));
    check(/35 of 35 entries/.test(count), `after reload: ledger has 27 demo + 8 new entries (${count})`);
    const ctx2Page = await ctx.newPage();
    await ctx2Page.goto(BASE + `/orders/${o1}`);
    await ctx2Page.waitForLoadState('networkidle');
    check(await ctx2Page.getByRole('heading', { name: 'Test Customer Alpha' }).isVisible(), 'record visible in a newly opened tab');
    await ctx2Page.close();

    // ---------- Test 7 ----------
    current = 'Test 7 — Filters and exports';
    console.log(current);
    await goto('/orders');
    const rowIds = async () => (await page.locator('tbody tr').allInnerTexts()).map((r) => r.match(/KS-\d+/)[0]).sort();
    await page.getByLabel('Filter by status').selectOption('ready');
    check(JSON.stringify(await rowIds()) === '["KS-1004"]', 'status = Ready → KS-1004 only');
    await page.getByLabel('Filter by status').selectOption('all');
    await page.getByLabel('Filter by karigar').selectOption('none');
    check(JSON.stringify(await rowIds()) === '["KS-1010"]', 'karigar = Not assigned → KS-1010 only');
    await page.getByLabel('Filter by karigar').selectOption('all');
    await page.getByLabel('Filter by delivery date').selectOption('overdue');
    check(JSON.stringify(await rowIds()) === '["KS-1005"]', 'delivery = Overdue → KS-1005 only');
    await page.getByLabel('Filter by delivery date').selectOption('all');
    await page.getByLabel('Search orders').fill('Test Customer');
    check(JSON.stringify(await rowIds()) === JSON.stringify([o1, o2].sort()), 'search "Test Customer" → the two new orders');
    await page.getByLabel('Search orders').fill('');
    await page.getByLabel('Filter by karigar').selectOption('K-1');
    await page.getByLabel('Filter by status').selectOption('open');
    check(JSON.stringify(await rowIds()) === JSON.stringify(['KS-1005', 'KS-1006', o1, o2].sort()), 'combined filters: Ramesh + active');
    await page.reload();
    check(JSON.stringify(await rowIds()) === JSON.stringify(['KS-1005', 'KS-1006', o1, o2].sort()), 'filters kept in URL after reload');

    await goto('/ledger');
    let [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    let csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
    fs.writeFileSync(path.join(OUT, 'ledger-all.csv'), csv);
    let lines = csv.trim().split('\r\n');
    check(lines.length === 36, `full export: header + ${lines.length - 1} rows (expected 35)`);
    check(lines[0].startsWith('Date,Transaction ID,Karigar,Order ID,Transaction type'), 'CSV header columns');
    const o1rows = lines.filter((l) => l.includes(`,${o1},`));
    check(o1rows.length === 4 && o1rows.some((l) => l.includes('Gold Issued') && l.includes(',22K,20.000,')), `${o1} rows exported with exact weights`);
    check(lines.some((l) => l.includes('Yes — Typing mistake')), 'voided entry exported and marked voided');

    await page.getByLabel('Filter by karigar').selectOption('K-1');
    await page.getByLabel('Filter by type').selectOption('issue');
    const shownCount = Number((await text(page.getByText(/of \d+ entries/))).match(/(\d+) of/)[1]);
    [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
    fs.writeFileSync(path.join(OUT, 'ledger-ramesh-issues.csv'), csv);
    lines = csv.trim().split('\r\n').slice(1);
    check(lines.length === shownCount && lines.every((l) => l.includes(',Ramesh Soni,') && l.includes(',Gold Issued,')), `filtered export (Ramesh, Gold Issued): ${lines.length} rows = ${shownCount} shown`);
  } catch (e) {
    results.push({ test: current, ok: false, msg: `Exception: ${e.message.split('\n')[0]}` });
    console.log('  FAIL  Exception:', e.message);
    await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true });
  }

  current = 'Runtime';
  check(errors.length === 0, `no uncaught page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
