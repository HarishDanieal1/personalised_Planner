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

test('navigation reaches every page, with collapsible groups', async ({ page, isMobile }) => {
  await page.goto('/');
  const open = async () => { if (isMobile) await page.locator('[data-toggle-nav]').click(); };
  for (const [id, heading] of [['day', /day,/i], ['week', /Week of/], ['month', /\d{4}$/], ['year', /^\d{4}$/], ['board', 'Board'], ['reset', 'Reset'], ['settings', 'Settings'], ['dashboard', 'Dashboard']] as const) {
    await open();
    await page.locator(`.sidenav a[data-page="${id}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
  // Financial starts collapsed; opening it reveals its pages.
  await open();
  const toggle = page.locator('[data-group="financial"] .nav-group-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.sidenav a[data-page="fin-budget"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Budget');
  await expect(page.getByText('These are sample numbers')).toBeVisible();
  await shot(page, 'financial-budget');
});

test('the left navigation stays in place while the page scrolls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'On phones the navigation is a drawer');
  await page.goto('/#year');
  const settings = page.locator('.sidenav a[data-page="settings"]');
  const before = (await settings.boundingBox())!.y;
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(Math.abs((await settings.boundingBox())!.y - before)).toBeLessThan(2);
  await shot(page, 'year');
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
  // The sticky top bar covers the first rows after scrolling, so use a row further down.
  if (isMobile) await page.touchscreen.tap(box.x + 20, box.y + 6 * 48 + 10);
  else await page.mouse.click(box.x + 20, box.y + 4 * 48 + 10);
  const blockName = page.locator('wa-dialog[open] wa-input input');
  await expect(blockName).toBeVisible();
  await blockName.fill('Standup');
  await blockName.press('Enter');
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

test('board: plan a sprint, work an issue and see its history', async ({ page, isMobile }) => {
  await page.goto('/#board/backlog');
  for (const t of ['Write weekly report', 'Plan next sprint']) {
    await page.locator('#quick-add-PER').click();
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('[data-drop="sprint:backlog:PER"] .issue-row')).toHaveCount(2);
  await expect(page.locator('.issue-row .key').first()).toHaveText('PER-1');

  // Create a sprint and move PER-1 into it through the issue dialog (works with keyboard and touch).
  const personal = page.locator('.project-block').first();
  await personal.getByText('Create sprint').click();
  await page.locator('.issue-row', { hasText: 'Write weekly report' }).click();
  const dialog = page.locator('wa-dialog[open]');
  // Pick from each dropdown, waiting for it to close before opening the next.
  const pick = async (label: string, option: RegExp) => {
    const select = dialog.locator(`wa-select[label="${label}"]`);
    await select.click();
    await select.locator('wa-option', { hasText: option }).click();
    await expect(select).not.toHaveAttribute('open', '');
  };
  await pick('Sprint', /PER Sprint 1/);
  await pick('Assignee', /^\s*AI\s*$/);
  await dialog.getByText('Save', { exact: true }).click();
  await expect(page.locator('[data-drop^="sprint:"][data-drop$=":PER"]:not([data-drop^="sprint:backlog"]) .issue-row')).toHaveCount(1);

  await personal.getByText('Start sprint').click();
  await page.locator('.segmented button', { hasText: 'Sprint board' }).click();
  await expect(page.locator('[data-drop="status:todo"] .tcard')).toHaveCount(1);
  if (!isMobile) {
    const card = (await page.locator('.tcard').first().boundingBox())!;
    const target = (await page.locator('[data-drop="status:doing"]').boundingBox())!;
    await page.mouse.move(card.x + 80, card.y + 20);
    await page.mouse.down();
    await page.mouse.move(target.x + 80, target.y + 30, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-drop="status:doing"] .tcard')).toHaveCount(1);
    // A click right after a drag is ignored on purpose, so open the card with the keyboard.
    await page.locator('.tcard').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('wa-dialog[open] .history-list')).toContainText('changed status from “To do” to “In progress”');
    await expect(page.locator('wa-dialog[open] .history-list')).toContainText('changed assignee from “Me” to “AI”');
    await expect(page.locator('wa-dialog[open] .history-list')).toContainText('changed sprint from “Backlog” to “PER Sprint 1”');
    await page.locator('wa-dialog[open]').getByText('Close', { exact: true }).click();
  }
  await shot(page, 'board');
});

test('board: filters narrow the backlog', async ({ page }) => {
  await page.goto('/#board/backlog');
  await page.locator('#quick-add-WORK').click();
  await page.keyboard.type('Fix login bug');
  await page.keyboard.press('Enter');
  await page.locator('#quick-add-PER').click();
  await page.keyboard.type('Buy groceries');
  await page.keyboard.press('Enter');
  await page.locator('.board-filters .chip', { hasText: 'Work' }).click();
  await expect(page.locator('.issue-row')).toHaveCount(1);
  await expect(page.locator('.issue-row')).toContainText('WORK-1');
  await page.getByText('Clear filters').click();
  await expect(page.locator('.issue-row')).toHaveCount(2);
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
