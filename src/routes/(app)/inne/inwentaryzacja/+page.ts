import { listInventories } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let warehouseId = url.searchParams.get('mg');
	let [open, done] = await Promise.all([listInventories({ status: 'OPEN', warehouseId }), listInventories({ status: 'DONE', warehouseId })]);
	return { open, done };
};
