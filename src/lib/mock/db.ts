import { createSeed, day } from '$lib/mock/mock';
import type { Db } from '$lib/types';

/**
 * "Baza danych" makiety: kopia danych z `mock.ts` trzymana w pamięci i utrwalana w localStorage,
 * żeby cały proces dało się przeklikać i przeżył odświeżenie strony.
 * Dane są generowane względem bieżącej daty – następnego dnia makieta zaczyna od nowa.
 */
const STORAGE_KEY = 'airflow-mobile-db-v1';

let db: Db | null = null;

export function getDb(): Db {
	if (db) return db;

	try {
		let raw = localStorage.getItem(STORAGE_KEY);
		let stored = raw ? (JSON.parse(raw) as Db) : null;
		db = stored && stored.seededOn === day(0) ? stored : createSeed();
	} catch {
		db = createSeed();
	}

	return db;
}

export function commit(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
	} catch {
		// brak localStorage (tryb prywatny, przekroczony limit) – stan zostaje tylko w pamięci
	}
}

export function reset(): void {
	db = createSeed();
	commit();
}
