import { listReceipts } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let p = url.searchParams;
	return { receipts: await listReceipts({ status: 'OPEN', warehouseId: p.get('mg'), dockId: p.get('dok') }) };
};
