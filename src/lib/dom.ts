// Tiny element builder. User text always goes in as text nodes, never as HTML.
type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...kids: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, props?: Props | null, ...kids: Child[]): HTMLElement;
export function h(tag: string, props?: Props | null, ...kids: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.style.cssText = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k.startsWith('.')) (el as unknown as Record<string, unknown>)[k.slice(1)] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  return el;
}

function append(el: HTMLElement, kids: Child[]): void {
  for (const c of kids) {
    if (c === null || c === undefined || c === false || c === '') continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** A Material Symbols icon through Web Awesome's icon element. */
export const icon = (name: string, label?: string, slot?: string): HTMLElement =>
  h('wa-icon', { name, label: label ?? null, slot: slot ?? null, 'aria-hidden': label ? null : 'true' });

/** Read a value from a Web Awesome or native form control. */
export const valueOf = (el: EventTarget | null): string => String((el as { value?: unknown } | null)?.value ?? '');
export const checkedOf = (el: EventTarget | null): boolean => Boolean((el as { checked?: unknown } | null)?.checked);

/** Focus an element by id after re-render, waiting for a Web Awesome control to finish rendering. */
export function focusById(id: string): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(id) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
    if (!el) return;
    void Promise.resolve(el.updateComplete).then(() => { try { el.focus(); } catch { /* element went away */ } });
  });
}
