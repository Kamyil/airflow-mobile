import { seed } from '$lib/data';
import type { Db } from '$lib/types';

/**
 * "Baza danych" makiety: kopia `seed` trzymana w pamięci i utrwalana w localStorage,
 * żeby cały proces dało się przeklikać i przeżył odświeżenie strony.
 */
const STORAGE_KEY = 'mws-mock-db-v2';

let db: Db | null = null;

export function getDb(): Db {
	if (db) return db;

	try {
		let raw = localStorage.getItem(STORAGE_KEY);
		db = raw ? (JSON.parse(raw) as Db) : structuredClone(seed);
	} catch {
		db = structuredClone(seed);
	}

	return db;
}

export function commit(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
	} catch {
		// brak localStorage (tryb prywatny itp.) – stan zostaje tylko w pamięci
	}
}

export function reset(): void {
	db = structuredClone(seed);
	commit();
}
