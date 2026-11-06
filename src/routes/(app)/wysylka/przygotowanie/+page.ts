import { listDispatchOrders } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let salesOrderNumber = url.searchParams.get('zamowienie');
	return { orders: await listDispatchOrders({ salesOrderNumber }), salesOrderNumber };
};
