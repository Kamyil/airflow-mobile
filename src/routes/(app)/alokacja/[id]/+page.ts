import { getAllocation } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ order: await getAllocation(params.id) });
