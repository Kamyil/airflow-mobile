import { listAllocations } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => ({ orders: await listAllocations({ status: 'OPEN', warehouseId: url.searchParams.get('mg') }) });
