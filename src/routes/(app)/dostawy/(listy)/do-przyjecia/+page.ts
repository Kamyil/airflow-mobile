import { listAdvices } from '$lib/api';
import { todayStr } from '$lib/format';
import type { TruckStatus } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let p = url.searchParams;
	let filter = {
		date: p.get('dzien') ?? todayStr(),
		warehouseId: p.get('mg'),
		dockId: p.get('dok'),
		truckStatus: p.get('auto') as TruckStatus | null,
		hour: p.get('h'),
		q: p.get('q')
	};
	return { advices: await listAdvices(filter), filter };
};
