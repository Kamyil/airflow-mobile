import { getReceipt } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return { receipt: await getReceipt(params.id) };
};
