import { isTracked } from '$lib/server/auth';
import { trackView } from '$lib/server/stats';
import type { RequestHandler } from './$types';

/** Wejście na ekran (wysyłane z klienta przez sendBeacon). Liczone tylko dla kont śledzonych. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isTracked(locals.user)) return new Response(null, { status: 204 });
	let screen = (await request.text()).trim().slice(0, 120);
	// tylko route id (np. /(app)/dostawy/pz/[id]) – nic dowolnego nie trafi do Redisa jako klucz
	if (/^\/[\w()[\]\/-]*$/.test(screen)) await trackView(screen);
	return new Response(null, { status: 204 });
};
