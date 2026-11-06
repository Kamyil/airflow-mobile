import { redirect } from '@sveltejs/kit';
import { getContext } from '$lib/api';
import { connectivity } from '$lib/connectivity.svelte';
import { getOperator } from '$lib/session';
import type { LayoutLoad } from './$types';

// Makieta działa w całości w przeglądarce (dane w localStorage)
export const ssr = false;
export const prerender = false;

let initialized = false;

export const load: LayoutLoad = async ({ url }) => {
	if (!initialized) {
		connectivity.init();
		initialized = true;
	}
	let operator = getOperator();
	if (!operator) redirect(307, `/pin?next=${encodeURIComponent(url.pathname + url.search)}`);
	return { context: await getContext(), operator };
};
