import { redirect, type Handle } from '@sveltejs/kit';
import { readSession, SESSION_COOKIE } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = readSession(event.cookies.get(SESSION_COOKIE));

	let routeId = event.route.id ?? '';
	let isPublic = routeId === '/login' || routeId === '/logout';

	if (routeId && !isPublic && !event.locals.user) redirect(303, '/login');
	if (routeId === '/login' && event.locals.user) redirect(303, '/kompletacja');

	return resolve(event);
};
