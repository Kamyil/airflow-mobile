import { listReceipts } from '$lib/api';
import { todayStr } from '$lib/format';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let p = url.searchParams;
	let date = p.get('dzien') ?? todayStr();
	return { receipts: await listReceipts({ status: 'DONE', warehouseId: p.get('mg'), dockId: p.get('dok'), date }), date };
};
