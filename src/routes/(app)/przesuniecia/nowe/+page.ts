import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => ({ warehouseId: url.searchParams.get('mg') });
