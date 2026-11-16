import type { HandleClientError } from '@sveltejs/kit';

/**
 * Siatka bezpieczeństwa na nowe wdrożenie: jeśli przeglądarka ma starą wersję apki,
 * a plik JS trasy już nie istnieje, przeładuj stronę (raz na adres) zamiast pokazywać 500.
 */
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i;

export const handleError: HandleClientError = ({ error }) => {
	let message = error instanceof Error ? error.message : String(error);
	if (CHUNK_ERROR.test(message)) {
		let key = `reload:${location.pathname}`;
		try {
			if (!sessionStorage.getItem(key)) {
				sessionStorage.setItem(key, '1');
				location.reload();
				return { message: 'Wczytuję nową wersję aplikacji…' };
			}
		} catch {
			// brak sessionStorage – pokaż zwykły błąd
		}
	}
	console.error(error);
	return { message: 'Coś poszło nie tak. Odśwież stronę.' };
};
