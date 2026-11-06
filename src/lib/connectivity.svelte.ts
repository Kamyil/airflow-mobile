/**
 * Stan połączenia + kolejka niewysłanych operacji (jak photoQueue w dok-app).
 * Makieta: dane i tak są lokalne, więc offline operacje wykonują się od razu,
 * a do kolejki trafia tylko informacja, co trzeba "dosłać" do backendu po powrocie sieci.
 */
export interface OutboxItem {
	id: number;
	label: string;
	at: string;
}

const OUTBOX_KEY = 'airflow-mobile-outbox';
const OFFLINE_KEY = 'airflow-mobile-offline';

class Connectivity {
	browserOnline = $state(true);
	#simulated = $state(false);
	outbox: OutboxItem[] = $state([]);
	syncing = $state(false);
	#seq = 0;

	/** Makieta: symulacja braku sieci (przeżywa odświeżenie strony) */
	get simulatedOffline() {
		return this.#simulated;
	}
	set simulatedOffline(v: boolean) {
		this.#simulated = v;
		try {
			localStorage.setItem(OFFLINE_KEY, v ? '1' : '');
		} catch {
			// brak localStorage
		}
	}

	get online() {
		return this.browserOnline && !this.simulatedOffline;
	}

	init() {
		this.browserOnline = navigator.onLine;
		try {
			this.#simulated = localStorage.getItem(OFFLINE_KEY) === '1';
			this.outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]');
			this.#seq = Math.max(0, ...this.outbox.map((o) => o.id));
		} catch {
			this.outbox = [];
		}
	}

	#persist() {
		try {
			localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox));
		} catch {
			// ignorujemy – kolejka zostaje w pamięci
		}
	}

	enqueue(label: string) {
		this.outbox = [...this.outbox, { id: ++this.#seq, label, at: new Date().toISOString() }];
		this.#persist();
	}

	/** Wysyła kolejkę (symulacja: po jednej operacji z opóźnieniem). Zwraca liczbę wysłanych. */
	async flush(): Promise<number> {
		if (this.syncing || !this.online || !this.outbox.length) return 0;
		this.syncing = true;
		let sent = 0;
		while (this.outbox.length && this.online) {
			await new Promise((r) => setTimeout(r, 250));
			this.outbox = this.outbox.slice(1);
			this.#persist();
			sent++;
		}
		this.syncing = false;
		return sent;
	}
}

export const connectivity = new Connectivity();
