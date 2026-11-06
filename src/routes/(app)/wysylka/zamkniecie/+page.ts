import { listDispatchOrders, listShipments } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	let [orders, shipments] = await Promise.all([listDispatchOrders(), listShipments()]);
	return { orders, shipments };
};
