const pad = (n: number) => String(n).padStart(2, '0');

/** Dzisiejsza data lokalnie (YYYY-MM-DD) */
export function todayStr(): string {
	let d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(isoDate: string, n: number): string {
	let [y, m, d] = isoDate.split('-').map(Number);
	let date = new Date(y, m - 1, d + n);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function diffDays(isoDate: string): number {
	let [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
	let [ty, tm, td] = todayStr().split('-').map(Number);
	return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
}

export function fmtDay(isoDate: string): string {
	let diff = diffDays(isoDate);
	if (diff === 0) return 'Dziś';
	if (diff === 1) return 'Jutro';
	if (diff === -1) return 'Wczoraj';
	let [, m, day] = isoDate.slice(0, 10).split('-');
	return `${day}.${m}`;
}

const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

/** "Dziś", "Jutro", "Pojutrze" albo "pt 14.11" */
export function fmtDayLong(isoDate: string): string {
	let diff = diffDays(isoDate);
	if (diff === 2) return 'Pojutrze';
	if (Math.abs(diff) <= 1) return fmtDay(isoDate);
	let [y, m, d] = isoDate.split('-').map(Number);
	return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${pad(d)}.${pad(m)}`;
}

export function fmtDate(isoDate: string): string {
	let [y, m, d] = isoDate.slice(0, 10).split('-');
	return `${d}.${m}.${y}`;
}

export function fmtTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(iso: string): string {
	return `${fmtDay(iso)}, ${fmtTime(iso)}`;
}

export function fmtKg(kg: number): string {
	return `${kg.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg`;
}

export function fmtDiff(n: number): string {
	return n > 0 ? `+${n}` : String(n);
}

export function plural(n: number, one: string, few: string, many: string): string {
	if (n === 1) return one;
	let mod10 = n % 10;
	let mod100 = n % 100;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}
