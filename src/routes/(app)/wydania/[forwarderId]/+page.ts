import { getDispatchGroup } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ group: await getDispatchGroup(params.forwarderId), forwarderId: params.forwarderId });
