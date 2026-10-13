// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const FILE_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const ITEMS = [['Base pledge', 99], ['Expansion', 35.5], ['Coins', 19.9], ['Sleeves', 0.1]];
const withItems = list => FILE_URL + '?' + new URLSearchParams(list.map(([name, price]) => [name, String(price)]));

const plus = (page, item, s) => page.getByRole('button', { name: `Add one ${item} in scenario ${s}` });
const minus = (page, item, s) => page.getByRole('button', { name: `Remove one ${item} in scenario ${s}` });
const count = (page, item, s) => plus(page, item, s).locator('xpath=preceding-sibling::span');
const totals = page => page.locator('tr:nth-last-child(2) th:nth-child(n+3)');
const diffs = page => page.locator('tr:last-child th:nth-child(n+3)');

// Every test fails on console errors, page errors, or any network request.
let problems;
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('file:')) problems.push('request: ' + r.url()); });
});
test.afterEach(() => expect(problems).toEqual([]));

test('starts with two empty scenarios', async ({ page }) => {
  await page.goto(FILE_URL);
  await expect(totals(page)).toHaveText(['0.00', '0.00']);
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

test('two scenarios give two correct, independent totals', async ({ page }) => {
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

test('shows the difference with scenario 1', async ({ page }) => {
  await page.goto(withItems(ITEMS));
  await page.getByRole('button', { name: 'Add scenario' }).click();
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
  await page.getByRole('button', { name: 'Add scenario' }).click();
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
