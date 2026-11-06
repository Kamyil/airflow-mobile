import { listShipments } from '$lib/api';
import { todayStr } from '$lib/format';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let date = url.searchParams.get('dzien') ?? todayStr();
	return { shipments: await listShipments({ date }), date };
};
