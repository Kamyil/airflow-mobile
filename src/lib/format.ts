const TODAY = () => new Date().toISOString().slice(0, 10);

export function fmtDay(isoDate: string): string {
	let d = isoDate.slice(0, 10);
	let today = new Date(TODAY());
	let diff = Math.round((new Date(d).getTime() - today.getTime()) / 86_400_000);
	if (diff === 0) return 'Dziś';
	if (diff === 1) return 'Jutro';
	if (diff === -1) return 'Wczoraj';
	let [, m, day] = d.split('-');
	return `${day}.${m}`;
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

export function plural(n: number, one: string, few: string, many: string): string {
	if (n === 1) return one;
	let mod10 = n % 10;
	let mod100 = n % 100;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}
