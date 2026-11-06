import { getDispatchGroup, listEmailGroups } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	let [group, emailGroups] = await Promise.all([getDispatchGroup(params.forwarderId), listEmailGroups()]);
	return { group, emailGroups, forwarderId: params.forwarderId };
};
