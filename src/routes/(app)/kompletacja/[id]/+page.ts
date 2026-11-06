import { getPickingOrder } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return { po: await getPickingOrder(params.id) };
};
