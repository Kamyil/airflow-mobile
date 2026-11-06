import { redirect, type Handle } from '@sveltejs/kit';
import { readSession, SESSION_COOKIE } from '$lib/server/auth';

const PUBLIC = new Set(['/login', '/logout', '/install']);

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = readSession(event.cookies.get(SESSION_COOKIE));

	let routeId = event.route.id ?? '';
	if (routeId && !PUBLIC.has(routeId) && !event.locals.user) redirect(303, '/login');
	if (routeId === '/login' && event.locals.user) redirect(303, '/');

	return resolve(event);
};
