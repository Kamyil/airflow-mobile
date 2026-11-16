import { listAdvices } from '$lib/api';
import { addDays, todayStr } from '$lib/format';
import type { PageLoad } from './$types';

/**
 * Filtr dni: wczoraj / dziś / jutro (wybór wielokrotny, ?dni=-1,0)
 * albo konkretna data z kalendarza (?data=YYYY-MM-DD) – wtedy zastępuje szybki wybór.
 */
export const _DAY_OFFSETS = [-1, 0, 1] as const;

export const load: PageLoad = async ({ url }) => {
	let p = url.searchParams;
	let date = p.get('data');
	if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = null;
	let offsets = (p.get('dni') ?? '0')
		.split(',')
		.map(Number)
		.filter((n) => (_DAY_OFFSETS as readonly number[]).includes(n));
	if (date) offsets = [];
	else if (!offsets.length) offsets = [0];
	let filter = {
		offsets,
		date,
		dates: date ? [date] : offsets.map((n) => addDays(todayStr(), n)),
		warehouseId: p.get('mg'),
		dockId: p.get('dok'),
		q: p.get('q')
	};
	return { advices: await listAdvices(filter), filter };
};
