import { listTransfers } from '$lib/api';
import type { TransferSource } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => ({
	transfers: await listTransfers({ status: 'OPEN', warehouseId: url.searchParams.get('mg'), source: url.searchParams.get('zrodlo') as TransferSource | null })
});
