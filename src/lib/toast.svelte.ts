import { ApiError } from '$lib/api';

export type ToastTone = 'ok' | 'bad' | 'info' | 'warn';

export interface Toast {
	id: number;
	tone: ToastTone;
	title: string;
	description?: string;
	details?: string[];
}

class Toasts {
	items: Toast[] = $state([]);
	#seq = 0;

	push(t: Omit<Toast, 'id'>, ttl = 3800) {
		let id = ++this.#seq;
		this.items = [...this.items, { ...t, id }];
		setTimeout(() => this.dismiss(id), ttl);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new Toasts();

export const toast = {
	ok: (title: string, description?: string) => toasts.push({ tone: 'ok', title, description }),
	info: (title: string, description?: string) => toasts.push({ tone: 'info', title, description }),
	warn: (title: string, description?: string) => toasts.push({ tone: 'warn', title, description }),
	error(e: unknown) {
		if (e instanceof ApiError) toasts.push({ tone: 'bad', title: e.message, details: e.details }, 6000);
		else toasts.push({ tone: 'bad', title: 'Coś poszło nie tak', description: String(e) }, 6000);
	}
};
