// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const FILE_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const ITEMS = [['Base pledge', 99], ['Expansion', 35.5], ['Coins', 19.9], ['Sleeves', 0.1]];
const withItems = list => FILE_URL + '?' + new URLSearchParams(list.map(([name, price]) => [name, String(price)]));

const plus = (page, item, s) => page.getByRole('button', { name: `Add one ${item} in option ${s}` });
const minus = (page, item, s) => page.getByRole('button', { name: `Remove one ${item} in option ${s}` });
const count = (page, item, s) => plus(page, item, s).locator('xpath=preceding-sibling::span');
const totals = page => page.locator('tfoot tr:first-child th:nth-child(n+3)');
const diffs = page => page.locator('tfoot tr:last-child th:nth-child(n+3)');

// Every test fails on console errors, page errors, or any network request.
let problems;
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('file:')) problems.push('request: ' + r.url()); });
});
test.afterEach(() => expect(problems).toEqual([]));

test('starts with two empty options', async ({ page }) => {
  await page.goto(FILE_URL);
  await expect(totals(page)).toHaveText(['0.00', '0.00']);
});

test('"Add option" sits in the column after the last option', async ({ page }) => {
  await page.goto(FILE_URL);
  const add = page.getByRole('button', { name: 'Add option' });
  await expect(page.locator('thead th')).toHaveText(['Item', 'Price', 'Option 1', 'Option 2×', 'Add option']);
  await add.click();
  await expect(page.locator('thead th').last()).toHaveText('Add option');
  await expect(page.locator('thead th').nth(4)).toHaveText('Option 3×');
  await expect(add).toBeFocused();
});

test('deletes the last option, but never the only one', async ({ page }) => {
  await page.goto(withItems(ITEMS) + '&_sc=0,1,2');
  await expect(page.getByRole('button', { name: /^Delete option/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete option 3' }).click();
  await expect(totals(page)).toHaveText(['99.00', '35.50']);
  await expect(page).toHaveURL(/_sc=0%2C1$/);

  await page.getByRole('button', { name: 'Delete option 2' }).click();
  await expect(totals(page)).toHaveText(['99.00']);
  await expect(page.getByRole('button', { name: /^Delete option/ })).toHaveCount(0);
});

test('loads items from the query param', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await expect(page.locator('tr:has(.step) td:nth-child(2)')).toHaveText(['99.00', '35.50', '19.90', '0.10']);
});

test('accepts a hand-typed URL with currencies and decimal commas', async ({ page }) => {
  await page.goto(FILE_URL + '?Base pledge=€99&Coins=19,90&Dice %26 Co=$7');
  await expect(page.locator('tr:has(.step) td:nth-child(1)')).toHaveText(['Base pledge', 'Coins', 'Dice & Co']);
  await expect(page.locator('tr:has(.step) td:nth-child(2)')).toHaveText(['99.00', '19.90', '7.00']);
});

test('item names are shown as plain text, never as HTML', async ({ page }) => {
  await page.goto(withItems([['<b>Pack</b>', 5]]));
  await expect(page.locator('tbody td.name')).toHaveText('<b>Pack</b>');
  await expect(page.locator('tbody b')).toHaveCount(0);
});

test('two options give two correct, independent totals', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await plus(page, 'Base pledge', 1).click();
  await plus(page, 'Expansion', 1).click();
  await plus(page, 'Base pledge', 2).click();
  await plus(page, 'Coins', 2).click();
  await plus(page, 'Sleeves', 2).click();
  await expect(totals(page)).toHaveText(['134.50', '119.00']);

  await minus(page, 'Expansion', 1).click();
  await expect(totals(page)).toHaveText(['99.00', '119.00']);
});

test('shows the difference with option 1', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await page.getByRole('button', { name: 'Add option' }).click();
  await plus(page, 'Base pledge', 1).click();
  await plus(page, 'Expansion', 1).click();
  await plus(page, 'Base pledge', 2).click();
  await plus(page, 'Coins', 2).click();
  await plus(page, 'Base pledge', 3).click();
  await plus(page, 'Sleeves', 3).click();
  await expect(diffs(page)).toHaveText(['', '-15.60', '-35.40']);
  await expect(diffs(page).nth(1)).toHaveClass('cheaper');

  await minus(page, 'Expansion', 1).click();
  await expect(diffs(page)).toHaveText(['', '+19.90', '+0.10']);
  await expect(diffs(page).nth(1)).toHaveClass('pricier');
});

test('reloading the page keeps all state', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await page.getByRole('button', { name: 'Add option' }).click();
  await plus(page, 'Coins', 1).click();
  await plus(page, 'Expansion', 3).click();
  await page.reload();
  await expect(count(page, 'Coins', 1)).toHaveText('1');
  await expect(count(page, 'Expansion', 3)).toHaveText('1');
  await expect(count(page, 'Base pledge', 1)).toHaveText('0');
  await expect(totals(page)).toHaveText(['19.90', '0.00', '35.50']);
});

test('quantities: "+" adds one, "−" removes one', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await expect(count(page, 'Coins', 2)).toHaveText('0');
  await expect(minus(page, 'Coins', 2)).toBeDisabled();

  await plus(page, 'Coins', 2).click();
  await expect(totals(page)).toHaveText(['0.00', '19.90']);
  await plus(page, 'Coins', 2).click();
  await plus(page, 'Coins', 2).click();
  await expect(count(page, 'Coins', 2)).toHaveText('3');
  await expect(totals(page)).toHaveText(['0.00', '59.70']);
  await expect(page).toHaveURL(/_sc=%2C2x3$/);

  await page.reload();
  await expect(count(page, 'Coins', 2)).toHaveText('3');

  for (let n = 0; n < 3; n++) await minus(page, 'Coins', 2).click();
  await expect(count(page, 'Coins', 2)).toHaveText('0');
  await expect(minus(page, 'Coins', 2)).toBeDisabled();
  await expect(totals(page)).toHaveText(['0.00', '0.00']);
});

test('reads quantities from a hand-typed _sc', async ({ page }) => {
  await page.goto(withItems(ITEMS) + '&_sc=0.3x10,1x2');
  await expect(totals(page)).toHaveText(['100.00', '71.00']);
});

test('tax: no tax rows when empty, tax and total with tax when set', async ({ page }) => {
  const taxRows = page.locator('tfoot tr:nth-child(2), tfoot tr:nth-child(3)');
  await page.goto(withItems(ITEMS) + '&_sc=0.2,1');
  await expect(taxRows).toHaveCount(2);
  await expect(taxRows.first()).toBeHidden();
  await expect(taxRows.last()).toBeHidden();

  await page.getByLabel('Tax (%)').fill('20');
  // option 1 = 99 + 19.90 = 118.90, option 2 = 35.50
  await expect(page.locator('tfoot tr:nth-child(2) th')).toHaveText(['Tax (20%)', '', '23.78', '7.10']);
  await expect(page.locator('tfoot tr:nth-child(3) th')).toHaveText(['Total with tax', '', '142.68', '42.60']);
  await expect(diffs(page)).toHaveText(['', '-100.08']); // diff on the total with tax
  await expect(page).toHaveURL(/_tax=20$/);

  await page.reload();
  await expect(page.getByLabel('Tax (%)')).toHaveValue('20');
  await expect(taxRows.first()).toBeVisible();

  await page.getByLabel('Tax (%)').fill('');
  await expect(taxRows.first()).toBeHidden();
  await expect(page).not.toHaveURL(/_tax/);
});

test('tax from a hand-typed URL accepts decimal commas', async ({ page }) => {
  await page.goto(withItems([['Thing', 100]]) + '&_sc=0,&_tax=7,5');
  await expect(page.getByLabel('Tax (%)')).toHaveValue('7.5');
  await expect(page.locator('tfoot tr:nth-child(3) th')).toHaveText(['Total with tax', '', '107.50', '0.00']);
});

test('tax sits right of the items list, and wraps under it on small screens', async ({ page }) => {
  const list = page.getByLabel(/Items, one per line/);
  const tax = page.getByLabel('Tax (%)');
  const apply = page.getByRole('button', { name: 'Apply list' });

  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(FILE_URL);
  let [l, t, a] = [await list.boundingBox(), await tax.boundingBox(), await apply.boundingBox()];
  expect(t.x).toBeGreaterThan(l.x + l.width);
  expect(a.y).toBeGreaterThan(l.y + l.height);

  await page.setViewportSize({ width: 360, height: 800 });
  [l, t, a] = [await list.boundingBox(), await tax.boundingBox(), await apply.boundingBox()];
  expect(t.y).toBeGreaterThan(l.y + l.height);
  expect(a.y).toBeGreaterThan(t.y + t.height);
  expect(l.x + l.width).toBeLessThanOrEqual(360); // textarea fits the screen
});

test('textarea tolerates currencies, spaces and decimal commas', async ({ page }) => {
  await page.goto(FILE_URL);
  await page.getByLabel(/Items, one per line/).fill(
    'Base pledge,99\nStretch pack, 25,50\nCoins, €19.90\nDice,$ 7\nnot an item\n',
  );
  await page.getByRole('button', { name: 'Apply list' }).click();
  await expect(page.locator('tr:has(.step) td:nth-child(2)')).toHaveText(['99.00', '25.50', '19.90', '7.00']);

  await page.reload(); // pasted items end up in the URL too
  await expect(page.locator('tr:has(.step) td:nth-child(1)')).toHaveText(['Base pledge', 'Stretch pack', 'Coins', 'Dice']);
});

test('keyboard: Enter on "+" / "−" works and focus stays put', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await plus(page, 'Expansion', 2).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(totals(page)).toHaveText(['0.00', '71.00']);
  await expect(plus(page, 'Expansion', 2)).toBeFocused();

  await minus(page, 'Expansion', 2).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(totals(page)).toHaveText(['0.00', '0.00']);
  await expect(plus(page, 'Expansion', 2)).toBeFocused(); // "−" became disabled
});
