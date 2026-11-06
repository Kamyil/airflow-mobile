import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authenticate, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		let form = await request.formData();
		let login = String(form.get('login') ?? '');
		let user = authenticate(login, String(form.get('password') ?? ''));

		if (!user) return fail(400, { login, error: 'Nieprawidłowy login lub hasło.' });

		cookies.set(SESSION_COOKIE, createSession(user), {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE
		});
		redirect(303, '/kompletacja');
	}
};
