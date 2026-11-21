// Small single-series bar charts for dashboard cards. One series, so no legend:
// the card title names it. Each bar has a hover tooltip and the values are also
// available as a visually hidden table for screen readers.
import { h } from './dom';

const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

export interface BarChartOptions {
  label: string;            // accessible name, e.g. "Focus minutes, last 7 days"
  labels: string[];         // one per bar, e.g. "Mon 17"
  format: (v: number | null) => string;
  color: string;            // CSS colour for bars, e.g. var(--series-1)
  goal?: number;            // dashed reference line
  goalLabel?: string;
  over?: (v: number) => boolean; // bars that break a limit get the critical colour
  height?: number;
}

export function barChart(values: (number | null)[], o: BarChartOptions): HTMLElement {
  const W = 300, H = o.height ?? 72, top = 6, gap = 2;
  const max = Math.max(o.goal ?? 0, ...values.map((v) => v ?? 0), 1);
  const bw = W / values.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bar-chart', role: 'img', 'aria-label': o.label, preserveAspectRatio: 'none' });
  root.append(svg('line', { x1: 0, x2: W, y1: H - 0.5, y2: H - 0.5, class: 'chart-baseline' }));
  const tip = h('div', { class: 'chart-tip', role: 'tooltip', hidden: true });
  values.forEach((v, i) => {
    const bh = v ? (v / max) * (H - top) : 0;
    const x = i * bw + gap / 2, w = Math.max(1, bw - gap);
    const hit = svg('rect', { x: i * bw, y: 0, width: bw, height: H, class: 'chart-hit' });
    const bar = v
      ? svg('path', { d: roundedTop(x, H - bh, w, bh, Math.min(4, w / 2, bh)), class: 'chart-bar' })
      : svg('rect', { x, y: H - 2, width: w, height: 2, class: 'chart-empty' });
    if (v && o.over?.(v)) bar.classList.add('is-over');
    else if (v) (bar as SVGElement).style.fill = o.color;
    root.append(bar, hit);
    const show = (): void => {
      tip.hidden = false;
      tip.textContent = `${o.labels[i]}: ${o.format(v)}`;
      tip.style.left = `${((i + 0.5) / values.length) * 100}%`;
      bar.classList.add('is-hover');
    };
    const hide = (): void => { tip.hidden = true; bar.classList.remove('is-hover'); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
  });
  if (o.goal) {
    const y = H - (o.goal / max) * (H - top);
    root.append(svg('line', { x1: 0, x2: W, y1: y, y2: y, class: 'chart-goal' }));
  }
  const table = h('table', { class: 'visually-hidden' },
    h('caption', null, o.label),
    h('tbody', null, values.map((v, i) => h('tr', null, h('th', { scope: 'row' }, o.labels[i]), h('td', null, o.format(v))))));
  return h('div', { class: 'chart', style: `--chart-h:${H}px` }, root, tip, table,
    o.goal && o.goalLabel ? h('div', { class: 'chart-goal-label' }, o.goalLabel) : null);
}

function roundedTop(x: number, y: number, w: number, hgt: number, r: number): string {
  return `M${x},${y + hgt} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + hgt} Z`;
}
