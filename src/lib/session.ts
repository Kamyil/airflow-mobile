import type { Operator } from '$lib/types';

/**
 * Sesja operatora na urządzeniu (logowanie PIN-em, jak w dok-app).
 * Urządzenie loguje się kontem (login/hasło, ciasteczko serwerowe), a magazynier na zmianie – PIN-em.
 */
const KEY = 'airflow-mobile-operator';
const TTL_MS = 12 * 60 * 60 * 1000;

export type SessionOperator = Pick<Operator, 'id' | 'name' | 'role'>;

export function getOperator(): SessionOperator | null {
	try {
		let raw = localStorage.getItem(KEY);
		if (!raw) return null;
		let s = JSON.parse(raw) as SessionOperator & { at: number };
		if (Date.now() - s.at > TTL_MS) return null;
		return { id: s.id, name: s.name, role: s.role };
	} catch {
		return null;
	}
}

export function setOperator(op: SessionOperator | null) {
	try {
		if (op) localStorage.setItem(KEY, JSON.stringify({ ...op, at: Date.now() }));
		else localStorage.removeItem(KEY);
	} catch {
		// brak localStorage
	}
}

export const currentOperatorName = () => getOperator()?.name ?? null;
