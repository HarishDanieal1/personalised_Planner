// Financial: placeholder pages with clearly labelled sample data. Nothing here reads
// real accounts yet; how money data gets in (manual entry, CSV import or a bank
// connection) is a later decision. Account services such as credit monitoring are
// shown as "not set up" cards rather than imitated.
import { h, icon } from '../lib/dom';
import { barChart } from '../lib/charts';
import { card, pageHead } from '../app/ui';

export interface FinancePage { id: string; label: string; icon: string; section?: string }

export const FINANCE_PAGES: FinancePage[] = [
  { id: 'fin-overview', label: 'Overview', icon: 'account_balance_wallet' },
  { id: 'fin-spending', label: 'Spending', icon: 'payments' },
  { id: 'fin-transactions', label: 'Transactions', icon: 'swap_horiz' },
  { id: 'fin-budget', label: 'Budget', icon: 'calculate' },
  { id: 'fin-recurring', label: 'Recurring', icon: 'autorenew' },
  { id: 'fin-categories', label: 'Categories', icon: 'donut_large' },
  { id: 'fin-reports', label: 'Reports', icon: 'description' },
  { id: 'fin-investments', label: 'Investments', icon: 'pie_chart', section: 'Investing' },
  { id: 'fin-holdings', label: 'Holdings', icon: 'account_balance', section: 'Investing' },
  { id: 'fin-market', label: 'Market watch', icon: 'show_chart', section: 'Investing' },
  { id: 'fin-credit', label: 'Credit score', icon: 'speed', section: 'Planning' },
  { id: 'fin-equity', label: 'Equity', icon: 'home_work', section: 'Planning' },
  { id: 'fin-forecast', label: 'Forecast', icon: 'trending_up', section: 'Planning' },
  { id: 'fin-cash', label: 'Cash account', icon: 'attach_money', section: 'Planning' },
  { id: 'fin-estate', label: 'Estate planning', icon: 'gavel', section: 'Planning' },
  { id: 'fin-id', label: 'ID protection', icon: 'verified_user', section: 'Planning' },
  { id: 'fin-advisor', label: 'Advisor sessions', icon: 'support_agent', section: 'Planning' }
];

/* ---------- sample data (fictional) ---------- */
const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const NET_WORTH = [8200, 8650, 8400, 9100, 9550, 9800, 10400, 10250, 10900, 11300, 11800, 12350];
const INCOME = [4200, 4200, 4350, 4200, 4200, 4600, 4200, 4200, 4200, 4400, 4200, 4200];
const SPENT = [3650, 3300, 3900, 3500, 3480, 3920, 3360, 3710, 3420, 3550, 3390, 2860];
const DAILY = [42, 18, 96, 12, 0, 64, 130, 28, 15, 48, 9, 77, 22, 35];
const CATEGORIES: [string, number, number][] = [
  ['Rent', 1450, 1450], ['Groceries', 410, 450], ['Dining out', 265, 200], ['Transport', 140, 180],
  ['Subscriptions', 96, 80], ['Gaming', 60, 50], ['Health', 45, 100], ['Shopping', 230, 250], ['Other', 164, 200]
];
const TRANSACTIONS: [string, string, string, number][] = [
  ['Nov 21', 'Grocery store', 'Groceries', -64.12], ['Nov 20', 'Salary', 'Income', 2100], ['Nov 20', 'Coffee shop', 'Dining out', -6.4],
  ['Nov 19', 'Game store', 'Gaming', -29.99], ['Nov 18', 'Transit pass', 'Transport', -45], ['Nov 17', 'Pharmacy', 'Health', -18.3],
  ['Nov 16', 'Streaming service', 'Subscriptions', -15.49], ['Nov 15', 'Restaurant', 'Dining out', -48.75], ['Nov 14', 'Hardware store', 'Shopping', -32.1]
];
const RECURRING: [string, string, number][] = [
  ['Rent', 'Dec 1', 1450], ['Phone plan', 'Nov 28', 45], ['Streaming service', 'Dec 16', 15.49], ['Music service', 'Dec 3', 10.99],
  ['Cloud storage', 'Dec 9', 2.99], ['Game pass', 'Dec 12', 16.99], ['Gym', 'Dec 1', 35]
];
const HOLDINGS: [string, string, number, number][] = [
  ['Total market index fund', 'Brokerage', 5200, 8.4], ['International index fund', 'Brokerage', 1900, 4.1],
  ['Bond index fund', 'Retirement', 1450, 1.2], ['Target date fund', 'Retirement', 3100, 6.7], ['Cash', 'Brokerage', 420, 0]
];
const WATCH: [string, number, number][] = [
  ['Total market index', 1.2, 14.8], ['Tech sector index', 2.1, 21.3], ['Space industry index', -0.8, 9.6],
  ['Clean energy index', 0.4, -3.2], ['Bond market index', 0.1, 2.4]
];

const money = (n: number, cents = false): string =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
const pct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const fmtMoney = (v: number | null): string => money(v ?? 0);

function sampleNote(): HTMLElement {
  return h('wa-callout', { variant: 'neutral', class: 'sample-note' }, icon('description', undefined, 'icon'),
    'These are sample numbers so you can see the layout. Bringing in your real accounts comes in a later version.');
}

function hbars(rows: [string, number][], format: (n: number) => string, color = 'var(--series-1)'): HTMLElement {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return h('div', null, rows.map(([label, n]) => h('div', { class: 'hbar' },
    h('span', null, label),
    h('span', { class: 'track', title: `${label}: ${format(n)}` }, h('span', { style: `width:${(n / max) * 100}%;background:${color}` })),
    h('span', { class: 'num' }, format(n)))));
}

function table(head: string[], rows: (string | Node)[][], numeric: number[] = []): HTMLElement {
  return h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, head.map((x, i) => h('th', { scope: 'col', class: numeric.includes(i) ? 'is-num' : null }, x)))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', { class: numeric.includes(i) ? 'is-num' : null }, c)))))));
}

function notSetUp(what: string, detail: string): HTMLElement {
  return card(what, [
    h('p', { class: 'muted', style: 'margin:0 0 12px' }, detail),
    h('p', { class: 'metric-note', style: 'margin:0' }, 'Not set up. This needs a connected provider, which is planned for a later version. Until then, keep using the service you already have.')
  ]);
}

const change = (n: number): HTMLElement => h('span', { class: n < 0 ? 'delta is-down' : 'delta is-up' }, icon(n < 0 ? 'keyboard_arrow_down' : 'keyboard_arrow_up'), pct(n));

export function renderFinance(id: string): Node[] {
  const page = FINANCE_PAGES.find((p) => p.id === id) ?? FINANCE_PAGES[0];
  const head = pageHead(page.id === 'fin-overview' ? 'Financial' : page.label, { sub: page.id === 'fin-overview' ? 'Your money at a glance.' : undefined });
  const body = BODY[page.id]?.() ?? [];
  return [head, sampleNote(), h('div', { class: 'dash-grid', style: 'margin-top:16px' }, body)];
}

const totalSpent = CATEGORIES.reduce((a, c) => a + c[1], 0);
const totalBudget = CATEGORIES.reduce((a, c) => a + c[2], 0);

const BODY: Record<string, () => Node[]> = {
  'fin-overview': () => [
    card('Net worth', [
      h('div', { class: 'metric' }, money(NET_WORTH[11])),
      h('p', { class: 'metric-note' }, `${money(NET_WORTH[11] - NET_WORTH[10])} this month`),
      barChart(NET_WORTH, { label: 'Net worth by month', labels: MONTHS, format: fmtMoney, color: 'var(--series-1)', height: 96 })
    ], { class: 'span-2', actions: [h('a', { class: 'card-link', href: '#fin-forecast' }, 'Forecast')] }),
    card('Spent this month', [
      h('div', { class: 'metric' }, money(totalSpent)),
      h('p', { class: 'metric-note' }, `of ${money(totalBudget)} budgeted`),
      h('div', { class: 'meter' }, h('span', { style: `width:${Math.min(100, (totalSpent / totalBudget) * 100)}%;background:var(--series-1)` }))
    ], { actions: [h('a', { class: 'card-link', href: '#fin-budget' }, 'Budget')] }),
    card('Coming up', [h('ul', { class: 'list fin-list' }, RECURRING.slice(0, 4).map(([n, d, a]) => h('li', null, h('span', null, n), h('span', { class: 'muted' }, d), h('span', { class: 'num' }, money(a, true)))))],
      { actions: [h('a', { class: 'card-link', href: '#fin-recurring' }, 'Recurring')] }),
    card('Investments', [
      h('div', { class: 'metric' }, money(HOLDINGS.reduce((a, x) => a + x[2], 0))),
      h('p', { class: 'metric-note' }, 'Across 2 accounts')
    ], { actions: [h('a', { class: 'card-link', href: '#fin-investments' }, 'Investments')] })
  ],
  'fin-spending': () => [
    card('Spending, last 14 days', [
      h('div', { class: 'metric' }, money(DAILY.reduce((a, b) => a + b, 0))),
      barChart(DAILY, { label: 'Spending per day, last 14 days', labels: DAILY.map((_, i) => `Nov ${8 + i}`), format: fmtMoney, color: 'var(--series-2)', height: 96 })
    ], { class: 'span-2' }),
    card('Top categories', [hbars(CATEGORIES.filter((c) => c[0] !== 'Rent').sort((a, b) => b[1] - a[1]).slice(0, 5).map((c) => [c[0], c[1]]), (n) => money(n))])
  ],
  'fin-transactions': () => [
    card('Recent transactions', [table(['Date', 'Description', 'Category', 'Amount'], TRANSACTIONS.map(([d, n, c, a]) => [d, n, c, money(a, true)]), [3])], { class: 'span-full' })
  ],
  'fin-budget': () => [
    card('This month', [
      h('div', { class: 'metric' }, money(totalBudget - totalSpent), h('small', null, 'left')),
      h('p', { class: 'metric-note' }, `${money(totalSpent)} spent of ${money(totalBudget)}`)
    ]),
    card('By category', [h('div', { class: 'stack', style: 'gap:12px' }, CATEGORIES.map(([n, spent, limit]) => {
      const over = spent > limit;
      return h('div', { class: 'progress-row' },
        h('span', null, n),
        over ? h('span', { class: 'status-over' }, icon('warning'), `Over by ${money(spent - limit)}`) : h('span', { class: 'muted num' }, `${money(spent)} of ${money(limit)}`),
        h('div', { class: `meter${over ? ' is-over' : ''}` }, h('span', { style: `width:${Math.min(100, (spent / limit) * 100)}%;background:var(--series-1)` })));
    }))], { class: 'span-2' })
  ],
  'fin-recurring': () => [
    card('Subscriptions and bills', [
      h('div', { class: 'metric' }, money(RECURRING.reduce((a, r) => a + r[2], 0), true), h('small', null, 'a month')),
      table(['Name', 'Next charge', 'Amount'], RECURRING.map(([n, d, a]) => [n, d, money(a, true)]), [2])
    ], { class: 'span-full' })
  ],
  'fin-categories': () => [
    card('Spending by category, this month', [hbars(CATEGORIES.map((c) => [c[0], c[1]] as [string, number]).sort((a, b) => b[1] - a[1]), (n) => money(n))], { class: 'span-2' })
  ],
  'fin-reports': () => [
    card('Income by month', [barChart(INCOME, { label: 'Income by month', labels: MONTHS, format: fmtMoney, color: 'var(--series-3)', height: 96 })], { class: 'span-2' }),
    card('Spending by month', [barChart(SPENT, { label: 'Spending by month', labels: MONTHS, format: fmtMoney, color: 'var(--series-2)', height: 96 })], { class: 'span-2' }),
    card('Saved this year', [h('div', { class: 'metric' }, money(INCOME.reduce((a, b) => a + b, 0) - SPENT.reduce((a, b) => a + b, 0))), h('p', { class: 'metric-note' }, 'Income minus spending, last 12 months')])
  ],
  'fin-investments': () => [
    card('Portfolio value', [
      h('div', { class: 'metric' }, money(HOLDINGS.reduce((a, x) => a + x[2], 0))),
      barChart([7100, 7300, 7250, 7800, 8100, 8350, 8900, 8800, 9400, 10100, 11300, 12070], { label: 'Portfolio value by month', labels: MONTHS, format: fmtMoney, color: 'var(--series-7)', height: 96 })
    ], { class: 'span-2' }),
    card('Allocation', [hbars(HOLDINGS.map((x) => [x[0], x[2]] as [string, number]), (n) => money(n), 'var(--series-7)')])
  ],
  'fin-holdings': () => [
    card('Holdings', [table(['Holding', 'Account', 'Value', 'Return'], HOLDINGS.map(([n, a, v, r]) => [n, a, money(v), r ? change(r) : '–']), [2, 3])], { class: 'span-full' })
  ],
  'fin-market': () => [
    card('Watchlist', [table(['Index', 'Today', 'This year'], WATCH.map(([n, d, y]) => [n, change(d), change(y)]), [1, 2])], { class: 'span-full' })
  ],
  'fin-credit': () => [notSetUp('Credit score', 'Your score from the credit bureaus and what moved it.')],
  'fin-equity': () => [notSetUp('Equity', 'Home value, loan balance and the equity between them, or stock grants from work.')],
  'fin-forecast': () => [
    card('Net worth forecast, next 12 months', [
      h('div', { class: 'metric' }, money(18900)),
      h('p', { class: 'metric-note' }, 'If you keep saving about $550 a month'),
      barChart([12350, 12900, 13450, 14000, 14550, 15100, 15650, 16200, 16750, 17300, 17850, 18400, 18900], { label: 'Forecast net worth by month', labels: ['Now', ...MONTHS.slice(0, 11), 'Dec'], format: fmtMoney, color: 'var(--series-1)', height: 96 })
    ], { class: 'span-2' })
  ],
  'fin-cash': () => [
    card('Cash balance', [h('div', { class: 'metric' }, money(3240, true)), h('p', { class: 'metric-note' }, 'Across checking and savings')]),
    card('Recent transfers', [table(['Date', 'Transfer', 'Amount'], [['Nov 20', 'Salary in', money(2100, true)], ['Nov 15', 'To savings', money(-400, true)], ['Nov 1', 'Rent', money(-1450, true)]], [2])], { class: 'span-2' })
  ],
  'fin-estate': () => [notSetUp('Estate planning', 'A will, beneficiaries and where your important documents are.')],
  'fin-id': () => [notSetUp('ID protection', 'Alerts when your details show up in a data breach.')],
  'fin-advisor': () => [notSetUp('Advisor sessions', 'Booked sessions with a financial planner and notes from each one.')]
};
