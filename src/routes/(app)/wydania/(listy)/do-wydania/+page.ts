import { listDispatchGroups } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => ({ groups: await listDispatchGroups({ dock: url.searchParams.get('dok') }) });
