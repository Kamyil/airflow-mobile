import { listPickingOrders } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { pickingOrders: await listPickingOrders() };
};
