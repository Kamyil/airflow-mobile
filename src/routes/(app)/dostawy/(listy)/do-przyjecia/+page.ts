import { listAdvices } from '$lib/api';
import { addDays, todayStr } from '$lib/format';
import type { PageLoad } from './$types';

/** Filtr dni: wczoraj / dziś / jutro (wybór wielokrotny), w adresie jako ?dni=-1,0 */
export const _DAY_OFFSETS = [-1, 0, 1] as const;

export const load: PageLoad = async ({ url }) => {
	let p = url.searchParams;
	let offsets = (p.get('dni') ?? '0')
		.split(',')
		.map(Number)
		.filter((n) => (_DAY_OFFSETS as readonly number[]).includes(n));
	if (!offsets.length) offsets = [0];
	let filter = {
		offsets,
		dates: offsets.map((n) => addDays(todayStr(), n)),
		warehouseId: p.get('mg'),
		dockId: p.get('dok'),
		q: p.get('q')
	};
	return { advices: await listAdvices(filter), filter };
};
