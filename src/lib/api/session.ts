import { reset } from '$lib/mock/db';
import { dispatchGroups } from '$lib/mock/domain';
import { adviceDTO } from '$lib/mock/warehouse';
import { setOperator, type SessionOperator } from '$lib/session';
import type { ContextDTO, Db, Operator } from '$lib/types';
import { ApiError, latency, query } from './core';

/** Kontekst aplikacji (liczniki na pulpicie, słowniki do filtrów) i logowanie PIN-em */

const today = () => new Date().toLocaleDateString('sv-SE');

export function getContext(): Promise<ContextDTO> {
	return query((db) => ({
		operator: db.operator,
		counts: {
			deliveries: db.advices
				.filter((a) => a.date === today())
				.map((a) => adviceDTO(db, a))
				.filter((a) => !a.fullyReceived && !a.openReceipt).length,
			receiptsOpen: db.receipts.filter((r) => r.status !== 'DONE').length,
			allocation: db.allocationOrders.filter((o) => !o.doneAt).length,
			transfers: db.transfers.filter((t) => t.status !== 'DONE').length,
			picking: db.pickingOrders.filter((po) => !po.releasedAt).length,
			dispatch: dispatchGroups(db).reduce((n, g) => n + g.orders.length, 0),
			inventory: db.inventories.filter((i) => i.status !== 'DONE').length
		},
		refs: { warehouses: db.warehouses, docks: db.docks }
	}));
}

/** Lista operatorów do ekranu PIN (bez PIN-ów) */
export function listOperators(): Promise<SessionOperator[]> {
	return query((db) => db.operators.map(({ id, name, role }) => ({ id, name, role })));
}

export async function loginWithPin(pin: string): Promise<SessionOperator> {
	let op = await query((db) => db.operators.find((o) => o.pin === pin) ?? null);
	if (!op) throw new ApiError('AUTH', 'Nieprawidłowy PIN');
	let session = { id: op.id, name: op.name, role: op.role };
	setOperator(session);
	return session;
}

export function logoutOperator() {
	setOperator(null);
}

/** Weryfikacja PIN-u przełożonego (wołane wewnątrz mutacji) */
export function assertSupervisor(db: Db, pin: string): Operator {
	let op = db.operators.find((o) => o.pin === pin.trim());
	if (!op || op.role !== 'KIEROWNIK') throw new ApiError('AUTH', 'Nieprawidłowy PIN przełożonego');
	return op;
}

/** Sprawdzenie PIN-u przełożonego przed wykonaniem operacji (rozbieżności) */
export function verifySupervisorPin(pin: string): Promise<{ name: string }> {
	return query((db) => ({ name: assertSupervisor(db, pin).name }));
}

export async function resetMockData(): Promise<void> {
	await latency();
	reset();
}


export { mockScanner } from '$lib/mock/mock';
