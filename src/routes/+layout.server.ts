import { isStatsViewer, isTracked } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user, track: isTracked(locals.user), statsViewer: isStatsViewer(locals.user) };
};
