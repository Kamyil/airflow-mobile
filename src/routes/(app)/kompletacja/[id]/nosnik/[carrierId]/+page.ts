import { error } from '@sveltejs/kit';
import { getPickingOrder } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	let po = await getPickingOrder(params.id);
	let carrier = po.carriers.find((c) => c.id === params.carrierId);
	if (!carrier) error(404, 'Nie znaleziono nośnika');
	return { po, carrier };
};
