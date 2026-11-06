import { getInventory } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ inventory: await getInventory(params.id) });
