import { env } from '$env/dynamic/private';

/**
 * Statystyki użycia makiety – tylko dla kont z `tracked: true` (patrz auth.ts).
 * Dane w Upstash Redis (REST, bez zależności). Bez skonfigurowanego store'a wszystko jest no-op,
 * więc lokalnie i na preview nic się nie sypie.
 *
 * Klucze:
 *   st:logins          hash  dzień → liczba logowań
 *   st:views           hash  ekran (route id) → liczba wejść
 *   st:viewdays        hash  dzień → liczba wejść na ekrany
 *   st:log             lista ostatnich zdarzeń (JSON), max LOG_SIZE
 */
const LOG_SIZE = 300;

type Cmd = (string | number)[];

const config = () => {
	let url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
	let token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
	return url && token ? { url, token } : null;
};

export const statsEnabled = () => config() !== null;

async function pipeline(cmds: Cmd[]): Promise<unknown[] | null> {
	let cfg = config();
	if (!cfg) return null;
	try {
		let res = await fetch(`${cfg.url}/pipeline`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${cfg.token}` },
			body: JSON.stringify(cmds)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		let out = (await res.json()) as { result?: unknown; error?: string }[];
		return out.map((r) => r.result ?? null);
	} catch (e) {
		// statystyki nigdy nie mogą wywrócić logowania ani nawigacji
		console.error('[stats]', e);
		return null;
	}
}

const day = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });

export type StatEvent = { t: number; type: 'login' | 'view'; screen?: string; ua?: string };

const logCmds = (ev: StatEvent): Cmd[] => [
	['LPUSH', 'st:log', JSON.stringify(ev)],
	['LTRIM', 'st:log', 0, LOG_SIZE - 1]
];

export async function trackLogin(userAgent: string | null) {
	await pipeline([['HINCRBY', 'st:logins', day(), 1], ...logCmds({ t: Date.now(), type: 'login', ua: userAgent?.slice(0, 200) })]);
}

export async function trackView(screen: string) {
	await pipeline([
		['HINCRBY', 'st:views', screen, 1],
		['HINCRBY', 'st:viewdays', day(), 1],
		...logCmds({ t: Date.now(), type: 'view', screen })
	]);
}

const hash = (raw: unknown): Record<string, number> => {
	let arr = Array.isArray(raw) ? (raw as string[]) : [];
	let out: Record<string, number> = {};
	for (let i = 0; i < arr.length; i += 2) out[arr[i]] = Number(arr[i + 1]);
	return out;
};

export type StatsReport = {
	logins: Record<string, number>;
	views: Record<string, number>;
	viewDays: Record<string, number>;
	log: StatEvent[];
};

export async function readStats(): Promise<StatsReport | null> {
	let res = await pipeline([
		['HGETALL', 'st:logins'],
		['HGETALL', 'st:views'],
		['HGETALL', 'st:viewdays'],
		['LRANGE', 'st:log', 0, LOG_SIZE - 1]
	]);
	if (!res) return null;
	return {
		logins: hash(res[0]),
		views: hash(res[1]),
		viewDays: hash(res[2]),
		log: ((res[3] as string[] | null) ?? []).flatMap((s) => {
			try {
				return [JSON.parse(s) as StatEvent];
			} catch {
				return [];
			}
		})
	};
}
