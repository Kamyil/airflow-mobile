import { listOperators } from '$lib/api';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	return { operators: await listOperators(), next: url.searchParams.get('next') ?? '/' };
};
