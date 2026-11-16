import { error } from '@sveltejs/kit';
import { isStatsViewer } from '$lib/server/auth';
import { readStats, statsEnabled } from '$lib/server/stats';
import type { PageServerLoad } from './$types';

/** Statystyki konta testowego – widoczne wyłącznie dla naszego konta wewnętrznego */
export const load: PageServerLoad = async ({ locals }) => {
	if (!isStatsViewer(locals.user)) error(404, 'Not found');
	return { enabled: statsEnabled(), stats: await readStats() };
};
