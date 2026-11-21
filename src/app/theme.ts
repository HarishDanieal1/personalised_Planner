// Light, dark or follow the system. The choice is a per-device preference.
export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'planner:theme';

export const getTheme = (): ThemeChoice => (localStorage.getItem(KEY) as ThemeChoice | null) ?? 'system';
export function setTheme(choice: ThemeChoice): void {
  localStorage.setItem(KEY, choice);
  applyTheme();
}

const media = window.matchMedia('(prefers-color-scheme: dark)');
export function applyTheme(): void {
  const choice = getTheme();
  const dark = choice === 'dark' || (choice === 'system' && media.matches);
  document.documentElement.classList.toggle('wa-dark', dark);
  document.documentElement.classList.toggle('wa-light', !dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#232426' : '#ffffff');
}
media.addEventListener('change', applyTheme);
