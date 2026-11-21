// Shared UI pieces: page header, cards, dialogs and a polite status message.
import { h, icon } from '../lib/dom';

export function pageHead(title: string, opts: { sub?: string; actions?: Node[] } = {}): HTMLElement {
  return h('div', { class: 'page-head' },
    h('h1', null, title),
    opts.actions?.length ? h('div', { class: 'actions' }, opts.actions) : null,
    opts.sub ? h('p', { class: 'sub' }, opts.sub) : null);
}

export type CardBody = (Node | string | null | false | undefined | CardBody)[];
export function card(title: string, body: CardBody, opts: { meta?: string; actions?: Node[]; class?: string; id?: string } = {}): HTMLElement {
  const titleId = `card-${Math.random().toString(36).slice(2, 8)}`;
  return h('section', { class: `card ${opts.class ?? ''}`.trim(), 'aria-labelledby': titleId, id: opts.id ?? null },
    h('div', { class: 'card-head' },
      h('h2', { id: titleId }, title),
      opts.meta ? h('span', { class: 'meta' }, opts.meta) : null,
      opts.actions?.length ? h('div', { class: 'actions' }, opts.actions) : null),
    body);
}

export function iconButton(name: string, label: string, onclick: (e: MouseEvent) => void, extra: Record<string, unknown> = {}): HTMLElement {
  return h('wa-button', { appearance: 'plain', size: 's', onclick, ...extra }, icon(name, label));
}

export function navButton(label: string, onclick: () => void, variant: 'neutral' | 'brand' = 'neutral', appearance = 'outlined'): HTMLElement {
  return h('wa-button', { variant, appearance, size: 's', onclick }, label);
}

/** Open a modal dialog. Resolves with the action id that closed it, or null for cancel. */
export function openDialog(label: string, body: Node[], actions: { id: string; label: string; variant?: 'brand' | 'danger' | 'neutral' }[]): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    const dialog = h('wa-dialog', { label, 'light-dismiss': true }, body,
      actions.map((a) => h('wa-button', {
        slot: 'footer',
        variant: a.variant ?? 'neutral',
        appearance: a.variant === 'brand' ? 'accent' : 'outlined',
        onclick: () => { result = a.id; (dialog as unknown as { open: boolean }).open = false; }
      }, a.label)));
    dialog.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Enter' && target.tagName === 'WA-INPUT') {
        const primary = actions.find((a) => a.variant === 'brand');
        if (primary) { e.preventDefault(); result = primary.id; (dialog as unknown as { open: boolean }).open = false; }
      }
    });
    dialog.addEventListener('wa-after-hide', (e) => {
      if (e.target !== dialog) return;
      dialog.remove();
      resolve(result);
    });
    document.body.append(dialog);
    requestAnimationFrame(() => { (dialog as unknown as { open: boolean }).open = true; });
  });
}

let liveRegion: HTMLElement | null = null;
/** Announce a short status message and show it briefly at the bottom of the screen. */
export function announce(message: string): void {
  if (!liveRegion) {
    liveRegion = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = message;
  liveRegion.classList.add('is-visible');
  window.clearTimeout(Number(liveRegion.dataset.timer));
  liveRegion.dataset.timer = String(window.setTimeout(() => liveRegion?.classList.remove('is-visible'), 3200));
}
