export const pad = (n: number): string => String(n).padStart(2, '0');
export const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = (): string => iso(new Date());
export const addDays = (s: string, n: number): string => {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Monday of the week containing the date. */
export const mondayOf = (s: string): string => {
  const d = fromIso(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
export const diffDays = (a: string, b: string): number => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 864e5);
/** Minutes since midnight as HH:MM. */
export const hm = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
/** Minutes since midnight as 9am, 9:30pm. */
export const h12 = (min: number): string => {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  return `${((h + 11) % 12) + 1}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`;
};
/** 75 -> "1h 15m". */
export const fmtMinutes = (m: number): string => {
  m = Math.round(m || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return `${h}h${r ? ' ' + r + 'm' : ''}`;
};
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (s: string): string => {
  const d = fromIso(s);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
};
export const shortDate = (s: string): string => {
  const d = fromIso(s);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};

/** Share of the calendar year that has passed by the end of `date`, as a whole percent (1 Jan is 1, 31 Dec is 100). */
export const yearProgress = (date: string): number => {
  const y = fromIso(date).getFullYear();
  const start = `${y}-01-01`;
  const total = diffDays(start, `${y + 1}-01-01`);
  return Math.round(((diffDays(start, date) + 1) / total) * 100);
};
