import { find } from '$lib/mock/domain';
import { addStock, allocationDetailDTO, allocationSummaryDTO, placedQty, takeStock } from '$lib/mock/warehouse';
import type { AllocationDetailDTO, AllocationSummaryDTO, Db } from '$lib/types';
import { ApiError, mutate, now, query, who } from './core';

/**
 * Alokacja – zlecenia magazynowe MWS wygenerowane po zamknięciu PZ.
 * Towar jest już na stanie, ale leży na miejscu odstawczym; magazynier rozkłada go na półki
 * w kolejności podpowiedzianej przez Impuls (odwrotność kompletacji, bez nośników).
 */

export function listAllocations(f: { status: 'OPEN' | 'DONE'; warehouseId?: string | null }): Promise<AllocationSummaryDTO[]> {
	return query((db) =>
		db.allocationOrders
			.filter((o) => (f.status === 'DONE' ? o.doneAt : !o.doneAt))
			.filter((o) => !f.warehouseId || o.warehouseId === f.warehouseId)
			.map((o) => allocationSummaryDTO(db, o))
			.sort((a, b) => (f.status === 'DONE' ? b.doneAt!.localeCompare(a.doneAt!) : a.createdAt.localeCompare(b.createdAt)))
	);
}

export function getAllocation(id: string): Promise<AllocationDetailDTO> {
	return query((db) => {
		let o = db.allocationOrders.find((x) => x.id === id);
		if (!o) throw new ApiError('NOT_FOUND', 'Nie znaleziono zlecenia magazynowego');
		return allocationDetailDTO(db, o);
	});
}

/** Alternatywne miejsca (gdy podpowiedziane jest zajęte / pełne) */
export function alternativeLocations(orderId: string, lineId: string): Promise<{ code: string; reason: string }[]> {
	return query((db) => {
		let o = find(db.allocationOrders, orderId);
		let line = find(o.lines, lineId);
		let withProduct = [...new Set(db.stock.filter((s) => s.warehouseId === o.warehouseId && s.productId === line.productId && !s.location.startsWith('ODST')).map((s) => s.location))]
			.filter((c) => c !== line.suggestedLocation)
			.map((code) => ({ code, reason: 'Leży tu już ten produkt' }));
		let occupied = new Set(db.stock.filter((s) => s.warehouseId === o.warehouseId).map((s) => s.location));
		let zone = line.suggestedLocation.slice(0, 1);
		let free = db.locations
			.filter((l) => l.warehouseId === o.warehouseId && l.kind === 'STORAGE' && l.zone === zone && !occupied.has(l.code))
			.slice(0, 4)
			.map((l) => ({ code: l.code, reason: 'Wolne miejsce w strefie ' + zone }));
		return [...withProduct, ...free].slice(0, 5);
	});
}

function editable(db: Db, orderId: string) {
	let o = find(db.allocationOrders, orderId);
	if (o.doneAt) throw new ApiError('VALIDATION', `${o.number} jest już zakończone`);
	return o;
}

/** Odłożenie towaru na półkę: zeskanowana lokalizacja + ilość */
export function placePutaway(input: { orderId: string; lineId: string; location: string; qty: number }): Promise<{ done: boolean }> {
	return mutate('Alokacja – odłożenie na półkę', (db) => {
		let o = editable(db, input.orderId);
		let line = o.lines.find((l) => l.id === input.lineId);
		if (!line) throw new ApiError('NOT_FOUND', 'Nie znaleziono pozycji');
		let code = input.location.trim().toUpperCase();
		let loc = db.locations.find((l) => l.warehouseId === o.warehouseId && l.code === code);
		if (!loc) throw new ApiError('VALIDATION', `Nieznana lokalizacja ${code}`);
		if (loc.kind !== 'STORAGE') throw new ApiError('VALIDATION', `${code} to miejsce odstawcze – wybierz półkę`);
		let remaining = line.qty - placedQty(line);
		if (!(input.qty > 0) || input.qty > remaining) throw new ApiError('VALIDATION', `Ilość musi być z zakresu 1–${remaining}`);

		let taken = takeStock(db, { warehouseId: o.warehouseId, location: line.fromLocation, productId: line.productId, qty: input.qty, batch: line.batch });
		for (let t of taken) addStock(db, { ...t, location: code });
		line.placements.push({ location: code, qty: input.qty, at: now(), by: who() });
		o.startedAt ??= now();
		if (input.qty === remaining) o.deferredLineIds = o.deferredLineIds.filter((id) => id !== line.id);
		if (o.lines.every((l) => placedQty(l) >= l.qty)) o.doneAt = now();
		return { done: o.doneAt !== null };
	});
}

export function deferPutaway(orderId: string, lineId: string): Promise<void> {
	return mutate('Alokacja – pominięcie pozycji', (db) => {
		let o = editable(db, orderId);
		o.deferredLineIds = [...o.deferredLineIds.filter((id) => id !== lineId), lineId];
		o.startedAt ??= now();
	});
}

