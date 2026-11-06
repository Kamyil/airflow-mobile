import { goto } from '$app/navigation';
import { page } from '$app/state';

/** Filtry list trzymane w adresie (?mg=…&dok=…) – przeżywają odświeżenie i powrót "wstecz" */
export function setParams(values: Record<string, string | null | undefined>) {
	let url = new URL(page.url);
	for (let [k, v] of Object.entries(values)) {
		if (v) url.searchParams.set(k, v);
		else url.searchParams.delete(k);
	}
	return goto(url, { replaceState: true, keepFocus: true, noScroll: true });
}
