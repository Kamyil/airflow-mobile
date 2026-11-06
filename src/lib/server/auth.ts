import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * Proste logowanie makiety. Konta są zahardkodowane, ale żyją wyłącznie w kodzie serwerowym
 * ($lib/server nie trafia do bundla przeglądarki). Sesja to podpisane HMAC ciasteczko,
 * więc nie da się jej podrobić w przeglądarce.
 */
const ACCOUNTS = [
	{ login: 'magazyn', password: 'mws2026', name: 'Jan Kowalski' },
	{ login: 'demo', password: 'demo2026', name: 'Konto demo' }
];

export const SESSION_COOKIE = 'mws_session';
export const SESSION_MAX_AGE = 12 * 60 * 60;

// Na Vercelu warto ustawić SESSION_SECRET; bez niego działa stały sekret makiety
const secret = () => env.SESSION_SECRET || 'mws-makieta-2026-lokalny-sekret';

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export type SessionUser = NonNullable<App.Locals['user']>;

export function authenticate(login: string, password: string): SessionUser | null {
	let account = ACCOUNTS.find((a) => a.login === login.trim().toLowerCase() && a.password === password);
	return account ? { login: account.login, name: account.name } : null;
}

export function createSession(user: SessionUser): string {
	let payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString('base64url');
	return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined): SessionUser | null {
	if (!token) return null;
	let [payload, signature] = token.split('.');
	if (!payload || !signature) return null;

	let expected = Buffer.from(sign(payload));
	let given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

	try {
		let data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionUser & { exp: number };
		if (data.exp < Date.now()) return null;
		return { login: data.login, name: data.name };
	} catch {
		return null;
	}
}
