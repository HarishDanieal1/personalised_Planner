// Planner's logo: a glass orb with a living core. Six neural nodes link to the core,
// a soft halo breathes around it, and an orbit ring passes behind and in front of the
// orb with one satellite. Motion stops when the person prefers reduced motion (app.css).
// Geometry matches public/icons/app-icon.svg.
const NS = 'http://www.w3.org/2000/svg';
let count = 0;

function el(tag: string, attrs: Record<string, string | number>, children: SVGElement[] = []): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...children);
  return node;
}

const NODES: [number, number][] = [[32, 21], [41.53, 26.5], [41.53, 37.5], [32, 43], [22.47, 37.5], [22.47, 26.5]];
const RING_BACK = 'M6.97 42.11 A27 9 -22 0 1 57.03 21.89';
const RING_FRONT = 'M6.97 42.11 A27 9 -22 0 0 57.03 21.89';
const LINKS = NODES.map(([x, y]) => `M32 32L${x} ${y}`).join(' ') + ' M' + NODES.map(([x, y]) => `${x} ${y}`).join(' L') + 'Z';

export function logo(size = 34): SVGElement {
  const id = `logo-${++count}`;
  const stops = (list: [string, string, string?][]): SVGElement[] =>
    list.map(([offset, color, opacity]) => el('stop', { offset, 'stop-color': color, ...(opacity ? { 'stop-opacity': opacity } : {}) }));
  return el('svg', { class: 'logo', viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' }, [
    el('defs', {}, [
      el('radialGradient', { id: `${id}-halo` }, stops([['0.55', 'var(--logo-mid)', '0.45'], ['1', 'var(--logo-mid)', '0']])),
      el('radialGradient', { id: `${id}-sphere`, cx: '42%', cy: '38%', r: '70%' }, stops([['0', 'var(--logo-core)', '0.9'], ['0.45', 'var(--logo-mid)'], ['1', 'var(--logo-deep)']])),
      el('radialGradient', { id: `${id}-core` }, stops([['0', '#ffffff'], ['0.45', 'var(--logo-core)'], ['1', 'var(--logo-core)', '0']]))
    ]),
    el('circle', { class: 'halo', cx: 32, cy: 32, r: 26, fill: `url(#${id}-halo)` }),
    el('path', { d: RING_BACK, fill: 'none', stroke: 'var(--logo-ring)', 'stroke-width': 1.5, 'stroke-opacity': '0.45' }),
    el('circle', { cx: 32, cy: 32, r: 19, fill: `url(#${id}-sphere)` }),
    el('circle', { cx: 32, cy: 32, r: 18.5, fill: 'none', stroke: '#ffffff', 'stroke-opacity': '0.35', 'stroke-width': 1 }),
    el('path', { class: 'links', d: LINKS, fill: 'none', stroke: 'var(--logo-core)', 'stroke-opacity': '0.4', 'stroke-width': 0.6 }),
    el('g', { fill: 'var(--logo-core)' }, NODES.map(([cx, cy], i) => el('circle', { class: 'spark', cx, cy, r: 1.4, style: `animation-delay:${(i * 0.75).toFixed(2)}s` }))),
    el('circle', { class: 'core', cx: 32, cy: 32, r: 8, fill: `url(#${id}-core)` }),
    el('ellipse', { cx: 25.5, cy: 22, rx: 5.5, ry: 2.6, fill: '#ffffff', 'fill-opacity': '0.4', transform: 'rotate(-30 25.5 22)' }),
    el('path', { d: RING_FRONT, fill: 'none', stroke: 'var(--logo-ring)', 'stroke-width': 1.6, 'stroke-opacity': '0.9' }),
    el('circle', { class: 'satellite', cx: 12.01, cy: 44.93, r: 2.4, fill: 'var(--logo-core)' })
  ]);
}
