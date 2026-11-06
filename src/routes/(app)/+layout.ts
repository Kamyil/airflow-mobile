import { getContext } from '$lib/api';
import type { LayoutLoad } from './$types';

// Makieta działa w całości w przeglądarce (dane w localStorage)
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
	return { context: await getContext() };
};
