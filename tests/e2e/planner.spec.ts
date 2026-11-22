import { test, expect, type Page } from '@playwright/test';

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screenshots/${test.info().project.name}-${name}.png`, fullPage: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('opens on the dashboard with every metric in its own card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  for (const title of ['Productivity', 'Top priorities', 'Time blocks', 'Habits', 'Focus', 'Gaming', 'Cooking', 'Exercise', 'This week', 'Board', 'Days steady']) {
    await expect(page.locator('.card-head h2', { hasText: new RegExp(`^${title}$`) })).toHaveCount(1);
  }
  await shot(page, 'dashboard-empty');
});

test('navigation reaches every page', async ({ page, isMobile }) => {
  await page.goto('/');
  for (const [label, heading] of [['Day', /day,/i], ['Week', /Week of/], ['Month', /\d{4}$/], ['Board', 'Board'], ['Reset', 'Reset'], ['Settings', 'Settings'], ['Dashboard', 'Dashboard']] as const) {
    if (isMobile) await page.locator('[data-toggle-nav]').click();
    await page.locator(`.sidenav a[data-page="${label.toLowerCase()}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});

test('day: priorities, brain dump and a time block feed the dashboard', async ({ page, isMobile }) => {
  await page.goto('/#day');
  await page.locator('#priority-0').fill('Ship weekly report');
  await page.locator('#dump-add').click();
  await page.keyboard.type('Call Joe');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-drag^="dump:"]')).toHaveCount(1);

  // Click a half-hour cell (keyboard and touch-friendly path), name the block.
  const layer = page.locator('.blocks');
  await layer.scrollIntoViewIfNeeded();
  const box = (await layer.boundingBox())!;
  // On phones the sticky top bar covers the first rows after scrolling, so tap a row further down.
  if (isMobile) await page.touchscreen.tap(box.x + 20, box.y + 6 * 48 + 10);
  else await page.mouse.click(box.x + 20, box.y + 10);
  await expect(page.locator('wa-dialog[open] wa-input')).toBeVisible();
  await page.keyboard.type('Standup');
  await page.keyboard.press('Enter');
  await expect(page.locator('.block:not(.preview)', { hasText: 'Standup' })).toBeVisible();

  await page.locator('.block', { hasText: 'Standup' }).locator('.check').click();
  await page.goto('/#dashboard');
  await expect(page.locator('.card', { has: page.locator('h2', { hasText: /^Time blocks$/ }) }).locator('.metric')).toContainText('1');
  await shot(page, 'dashboard-with-data');
});

test('day: drag a brain dump item onto the schedule', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse drag; touch uses the grip and is covered on desktop');
  await page.goto('/#day');
  await page.locator('#dump-add').click();
  await page.keyboard.type('Develop a new feature');
  await page.keyboard.press('Enter');
  const grip = (await page.locator('[data-drag^="dump:"] .grip').first().boundingBox())!;
  const layer = (await page.locator('.blocks').boundingBox())!;
  await page.mouse.move(grip.x + 5, grip.y + 5);
  await page.mouse.down();
  await page.mouse.move(layer.x + 100, layer.y + 4 * 48 + 10, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.block', { hasText: 'Develop a new feature' })).toBeVisible();
  await expect(page.locator('.tag-scheduled')).toHaveText('Scheduled');
  await shot(page, 'day');
});

test('board: add cards and drag one to In progress', async ({ page, isMobile }) => {
  await page.goto('/#board');
  for (const t of ['Write weekly report', 'Plan next sprint']) {
    await page.locator('#add-todo').click();
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('[data-drop="col:todo"] .tcard')).toHaveCount(2);
  if (!isMobile) {
    const card = (await page.locator('.tcard').first().boundingBox())!;
    const target = (await page.locator('[data-drop="col:doing"]').boundingBox())!;
    await page.mouse.move(card.x + 80, card.y + 20);
    await page.mouse.down();
    await page.mouse.move(target.x + 80, target.y + 30, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-drop="col:doing"] .tcard')).toHaveCount(1);
  }
  await shot(page, 'board');
});

test('week: matrix items and habit ticks are saved', async ({ page }) => {
  await page.goto('/#week');
  await page.locator('#quad-add-q1').click();
  await page.keyboard.type('Fix login bug');
  await page.keyboard.press('Enter');
  await page.locator('.habit-table .dot').first().click();
  await page.reload();
  await expect(page.locator('.quad.q1 .row-text')).toHaveValue('Fix login bug');
  await expect(page.locator('.habit-table .dot').first()).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'week');
});

test('reset: the urge reset logs an entry', async ({ page }) => {
  await page.goto('/#reset');
  await page.getByText('I’m feeling the pull').click();
  await expect(page.locator('.urge-clock')).toBeVisible();
  await page.locator('.chip', { hasText: 'Bored' }).click();
  await page.getByText('I rode it out').click();
  await expect(page.locator('.log li')).toHaveCount(1);
  await shot(page, 'reset');
});

test('settings: add a tracker and it appears on the dashboard', async ({ page }) => {
  await page.goto('/#settings');
  await page.locator('#tracker-name').click();
  await page.keyboard.type('Reading');
  await page.getByText('Add tracker').click();
  await page.goto('/#dashboard');
  await expect(page.locator('.card-head h2', { hasText: /^Reading$/ })).toBeVisible();
  await page.goto('/#settings');
  await shot(page, 'settings');
});

test('month and search', async ({ page }) => {
  await page.goto('/#day');
  await page.locator('#priority-0').fill('Quarterly taxes');
  await page.goto('/#month');
  await expect(page.locator('.mcell.is-today')).toHaveCount(1);
  await shot(page, 'month');
  await page.locator('#global-search').click();
  await page.keyboard.type('taxes');
  await expect(page.locator('.search-results a')).toHaveCount(1);
});
