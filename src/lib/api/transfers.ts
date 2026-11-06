import { find } from '$lib/mock/domain';
import { addStock, locationStockDTO, movedQty, stockAt, takeStock, transferDTO } from '$lib/mock/warehouse';
import type { Db, LocationStockDTO, Product, TransferDTO, TransferSource } from '$lib/types';
import { ApiError, mutate, now, query, who } from './core';

/** Przesunięcia MM w obrębie magazynu: zlecone z ERP, wygenerowane przez MWS albo utworzone w apce */

export function listTransfers(f: { status: 'OPEN' | 'DONE'; warehouseId?: string | null; source?: TransferSource | null }): Promise<TransferDTO[]> {
	return query((db) =>
		db.transfers
			.filter((t) => (f.status === 'DONE' ? t.status === 'DONE' : t.status !== 'DONE'))
			.filter((t) => !f.warehouseId || t.warehouseId === f.warehouseId)
			.filter((t) => !f.source || t.source === f.source)
			.map((t) => transferDTO(db, t))
			.sort((a, b) => (f.status === 'DONE' ? b.doneAt!.localeCompare(a.doneAt!) : a.createdAt.localeCompare(b.createdAt)))
	);
}

export function getTransfer(id: string): Promise<TransferDTO> {
	return query((db) => {
		let t = db.transfers.find((x) => x.id === id);
		if (!t) throw new ApiError('NOT_FOUND', 'Nie znaleziono dokumentu MM');
		return transferDTO(db, t);
	});
}

/** Co leży na lokalizacji (skan półki) */
export function getLocationStock(warehouseId: string, code: string): Promise<LocationStockDTO> {
	return query((db) => {
		let dto = locationStockDTO(db, warehouseId, code.trim().toUpperCase());
		if (!dto) throw new ApiError('VALIDATION', `Nieznana lokalizacja ${code.trim().toUpperCase()} w tym magazynie`);
		return dto;
	});
}

/** Makieta: kilka lokalizacji z towarem – do podpowiedzi "symuluj skan" */
export function sampleLocations(warehouseId: string): Promise<string[]> {
	return query((db) => [...new Set(db.stock.filter((s) => s.warehouseId === warehouseId && !s.location.startsWith('ODST')).map((s) => s.location))].slice(0, 4));
}

/** Makieta: wolne lokalizacje – podpowiedź celu przesunięcia */
export function sampleFreeLocations(warehouseId: string, near: string): Promise<string[]> {
	return query((db) => {
		let occupied = new Set(db.stock.filter((s) => s.warehouseId === warehouseId).map((s) => s.location));
		let zone = near.slice(0, 1);
		return db.locations.filter((l) => l.warehouseId === warehouseId && l.kind === 'STORAGE' && l.zone === zone && !occupied.has(l.code)).slice(0, 3).map((l) => l.code);
	});
}

/** Wyszukanie produktu po EAN / indeksie */
export function findProduct(code: string): Promise<Product> {
	return query((db) => {
		let c = code.trim().toUpperCase();
		let p = db.products.find((x) => x.ean === c || x.sku.toUpperCase() === c);
		if (!p) throw new ApiError('VALIDATION', `Nie znaleziono produktu ${c}`);
		return p;
	});
}

function assertLocation(db: Db, warehouseId: string, code: string) {
	let loc = db.locations.find((l) => l.warehouseId === warehouseId && l.code === code);
	if (!loc) throw new ApiError('VALIDATION', `Nieznana lokalizacja ${code}`);
	return loc;
}

export interface NewTransferLine {
	productId: string;
	fromLocation: string;
	batch: string | null;
	qty: number;
	toLocation: string | null;
}

export function createTransfer(input: { warehouseId: string; reason: string; lines: NewTransferLine[]; submit: boolean }): Promise<{ id: string; number: string }> {
	return mutate('Utworzenie MM', (db) => {
		let errors: string[] = [];
		if (!input.lines.length) errors.push('Dodaj co najmniej jedną pozycję');
		for (let l of input.lines) {
			assertLocation(db, input.warehouseId, l.fromLocation);
			if (l.toLocation) {
				assertLocation(db, input.warehouseId, l.toLocation);
				if (l.toLocation === l.fromLocation) errors.push(`${l.fromLocation}: lokalizacja docelowa musi być inna niż źródłowa`);
			}
			let available = stockAt(db, input.warehouseId, l.fromLocation, l.productId, l.batch);
			if (!(l.qty > 0) || l.qty > available) errors.push(`${find(db.products, l.productId).sku}: na ${l.fromLocation} dostępne ${available}`);
		}
		if (errors.length) throw new ApiError('VALIDATION', 'Popraw dokument MM', errors);

		let seq = db.counters.transfer++;
		let id = `mm-${String(seq).padStart(4, '0')}`;
		let number = `MM/${now().slice(0, 4)}/${String(seq).padStart(4, '0')}`;
		db.transfers.push({
			id,
			number,
			warehouseId: input.warehouseId,
			source: 'APP',
			reason: input.reason.trim() || 'Przesunięcie z urządzenia',
			status: input.submit ? 'TODO' : 'DRAFT',
			createdAt: now(),
			createdBy: who(),
			startedAt: null,
			doneAt: null,
			lines: input.lines.map((l, i) => ({ id: `${id}-${i + 1}`, ...l, moves: [] }))
		});
		return { id, number };
	});
}

export function submitTransfer(id: string): Promise<void> {
	return mutate('Zatwierdzenie MM', (db) => {
		let t = find(db.transfers, id);
		if (t.status !== 'DRAFT') throw new ApiError('VALIDATION', 'Dokument nie jest szkicem');
		t.status = 'TODO';
	});
}

export function deleteTransferDraft(id: string): Promise<void> {
	return mutate('Usunięcie szkicu MM', (db) => {
		let t = find(db.transfers, id);
		if (t.status !== 'DRAFT') throw new ApiError('VALIDATION', 'Usunąć można tylko szkic');
		db.transfers = db.transfers.filter((x) => x.id !== id);
	});
}

/** Wykonanie przesunięcia pozycji: z lokalizacji źródłowej na zeskanowaną docelową */
export function executeTransferMove(input: { transferId: string; lineId: string; qty: number; to: string }): Promise<{ done: boolean }> {
	return mutate('Realizacja MM', (db) => {
		let t = find(db.transfers, input.transferId);
		if (t.status === 'DONE') throw new ApiError('VALIDATION', `${t.number} jest już zrealizowany`);
		let line = t.lines.find((l) => l.id === input.lineId);
		if (!line) throw new ApiError('NOT_FOUND', 'Nie znaleziono pozycji');
		let to = input.to.trim().toUpperCase();
		let loc = assertLocation(db, t.warehouseId, to);
		if (loc.kind !== 'STORAGE') throw new ApiError('VALIDATION', `${to} to miejsce odstawcze`);
		if (to === line.fromLocation) throw new ApiError('VALIDATION', 'Lokalizacja docelowa musi być inna niż źródłowa');
		let remaining = line.qty - movedQty(line);
		if (!(input.qty > 0) || input.qty > remaining) throw new ApiError('VALIDATION', `Ilość musi być z zakresu 1–${remaining}`);

		let taken;
		try {
			taken = takeStock(db, { warehouseId: t.warehouseId, location: line.fromLocation, productId: line.productId, qty: input.qty, batch: line.batch });
		} catch (e) {
			throw new ApiError('VALIDATION', (e as Error).message, ['Stan na półce nie zgadza się z dokumentem – zgłoś do inwentaryzacji.']);
		}
		for (let s of taken) addStock(db, { ...s, location: to });
		line.moves.push({ qty: input.qty, to, at: now(), by: who() });
		if (t.status === 'DRAFT' || t.status === 'TODO') t.status = 'IN_PROGRESS';
		t.startedAt ??= now();
		if (t.lines.every((l) => movedQty(l) >= l.qty)) {
			t.status = 'DONE';
			t.doneAt = now();
		}
		return { done: t.status === 'DONE' };
	});
}
