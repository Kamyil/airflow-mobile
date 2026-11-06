import { getShipment, listEmailGroups } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
	let [shipment, emailGroups] = await Promise.all([getShipment(params.id), listEmailGroups()]);
	return { shipment, emailGroups, fresh: url.searchParams.has('nowe') };
};
