import { commit, getDb } from '$lib/mock/db';
import { connectivity } from '$lib/connectivity.svelte';
import { currentOperatorName } from '$lib/session';
import type { Db } from '$lib/types';

/**
 * Rdzeń warstwy API makiety. Zachowuje się jak klient backendu: asynchronicznie, z opóźnieniem,
 * zwraca kopie danych i rzuca `ApiError` przy błędach walidacji.
 * Podpięcie prawdziwego backendu = podmiana implementacji funkcji w `$lib/api/*`.
 */

export type ApiErrorCode = 'VALIDATION' | 'LABEL_REQUIRED' | 'RELEASE_BLOCKED' | 'NOT_FOUND' | 'OFFLINE' | 'APPROVAL_REQUIRED' | 'AUTH';

export class ApiError extends Error {
	constructor(
		public code: ApiErrorCode,
		message: string,
		public details: string[] = []
	) {
		super(message);
	}
}

export const latency = (min = 120, spread = 180) => new Promise((r) => setTimeout(r, min + Math.random() * spread));
export const now = () => {
	// lokalny czas bez strefy – spójny z datami w mock.ts
	let d = new Date();
	let p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
export const clone = <T>(v: T): T => structuredClone(v);
export const who = () => currentOperatorName() ?? 'Operator';

export async function query<T>(fn: (db: Db) => T): Promise<T> {
	await latency();
	return clone(fn(getDb()));
}

/**
 * Operacja zmieniająca dane. Offline wykonuje się lokalnie i trafia do kolejki do wysłania.
 * `label` – opis operacji widoczny w kolejce offline.
 */
export async function mutate<T>(label: string, fn: (db: Db) => T): Promise<T> {
	if (connectivity.online) await latency();
	let result = fn(getDb());
	commit();
	if (!connectivity.online) connectivity.enqueue(label);
	return clone(result);
}

/** Operacje, które muszą przejść przez backend (np. wywołanie funkcji Impulsa) */
export function requireOnline(what: string) {
	if (!connectivity.online) throw new ApiError('OFFLINE', `Brak połączenia – ${what} wymaga sieci`, ['Operacja zostanie odblokowana po powrocie połączenia.']);
}
