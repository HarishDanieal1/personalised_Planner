// Pointer-based drag and drop that works with a mouse and with touch.
// Mark draggable items with data-drag="<payload>" and drop zones with data-drop="<zone>".
// With a mouse the whole item drags; on touch only its .grip handle does, so lists still scroll.
import { h } from './dom';

export type DropHandler = (payload: string, zone: string, index: number, ev: PointerEvent) => void;
export type HoverHandler = (zone: string | null, ev: PointerEvent | null) => void;

interface DragState {
  src: HTMLElement; x: number; y: number; id: number; active: boolean;
  dx?: number; dy?: number; ghost?: HTMLElement; ph?: HTMLElement; zone?: HTMLElement | null; index?: number;
}

let drag: DragState | null = null;
let suppressUntil = 0;
let onDrop: DropHandler | null = null;
let onHover: HoverHandler | null = null;

/** Each page sets its own handlers when it renders. */
export function setDragHandlers(drop: DropHandler | null, hover: HoverHandler | null = null): void {
  onDrop = drop;
  onHover = hover;
}
/** Ignore the click that follows a drag. */
export const suppressClick = (): void => { suppressUntil = Date.now() + 350; };

export function installDrag(): void {
  document.addEventListener('click', (e) => {
    if (Date.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); suppressUntil = 0; }
  }, true);

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const src = target.closest<HTMLElement>('[data-drag]');
    if (!src) return;
    const grip = target.closest('.grip');
    if (e.pointerType !== 'mouse' && !grip) return;
    if (!grip && target.closest('input,textarea,button,select,a,wa-input,wa-textarea,wa-checkbox,wa-button,wa-select')) return;
    if (grip) e.preventDefault();
    drag = { src, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
  });

  window.addEventListener('pointermove', (e) => {
    const s = drag;
    if (!s || e.pointerId !== s.id) return;
    if (!s.active) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
      s.active = true;
      const r = s.src.getBoundingClientRect();
      s.dx = s.x - r.left; s.dy = s.y - r.top;
      s.ghost = s.src.cloneNode(true) as HTMLElement;
      s.ghost.classList.add('drag-ghost');
      s.ghost.removeAttribute('id');
      s.ghost.style.width = `${r.width}px`;
      document.body.append(s.ghost);
      s.src.classList.add('is-dragging');
      document.body.classList.add('dragging');
      s.ph = h('div', { class: 'drop-marker', 'aria-hidden': 'true' });
    }
    e.preventDefault();
    s.ghost!.style.transform = `translate(${e.clientX - s.dx!}px, ${e.clientY - s.dy!}px)`;
    if (e.clientY < 80) window.scrollBy(0, -14); else if (e.clientY > innerHeight - 60) window.scrollBy(0, 14);
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zone = under?.closest<HTMLElement>('[data-drop]') ?? null;
    document.querySelectorAll('.drop-active').forEach((x) => { if (x !== zone) x.classList.remove('drop-active'); });
    s.zone = zone; s.index = 0;
    onHover?.(zone?.dataset.drop ?? null, e);
    if (zone && zone.dataset.list !== undefined) {
      zone.classList.add('drop-active');
      const items = [...zone.querySelectorAll<HTMLElement>(':scope > [data-drag]')].filter((x) => x !== s.src);
      let i = 0;
      for (const it of items) { const r = it.getBoundingClientRect(); if (e.clientY > r.top + r.height / 2) i++; }
      s.index = i;
      zone.insertBefore(s.ph!, items[i] ?? null);
    } else {
      s.ph!.remove();
      zone?.classList.add('drop-active');
    }
  }, { passive: false });

  const end = (e: PointerEvent, dropIt: boolean): void => {
    const s = drag;
    if (!s || e.pointerId !== s.id) return;
    drag = null;
    if (!s.active) return;
    s.ghost?.remove(); s.ph?.remove();
    s.src.classList.remove('is-dragging');
    document.body.classList.remove('dragging');
    document.querySelectorAll('.drop-active').forEach((x) => x.classList.remove('drop-active'));
    onHover?.(null, null);
    suppressClick();
    if (dropIt && s.zone && onDrop) onDrop(s.src.dataset.drag!, s.zone.dataset.drop!, s.index ?? 0, e);
  };
  window.addEventListener('pointerup', (e) => end(e, true));
  window.addEventListener('pointercancel', (e) => end(e, false));
}

export function moveInList<T>(list: T[], item: T, index: number): void {
  const from = list.indexOf(item);
  if (from >= 0) list.splice(from, 1);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, item);
}
