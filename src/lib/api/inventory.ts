import { find } from '$lib/mock/domain';
import { addStock, inventoryDTO, stockAt, takeStock } from '$lib/mock/warehouse';
import type { InventoryDTO } from '$lib/types';
import { ApiError, mutate, now, query, who } from './core';
import { assertSupervisor } from './session';

/** Inwentaryzacja ze stanem systemowym: magazynier potwierdza albo koryguje ilości per lokalizacja */

export function listInventories(f: { status: 'OPEN' | 'DONE'; warehouseId?: string | null }): Promise<InventoryDTO[]> {
	return query((db) =>
		db.inventories
			.filter((i) => (f.status === 'DONE' ? i.status === 'DONE' : i.status !== 'DONE'))
			.filter((i) => !f.warehouseId || i.warehouseId === f.warehouseId)
			.map((i) => inventoryDTO(db, i))
			.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
	);
}

export function getInventory(id: string): Promise<InventoryDTO> {
	return query((db) => {
		let inv = db.inventories.find((x) => x.id === id);
		if (!inv) throw new ApiError('NOT_FOUND', 'Nie znaleziono inwentaryzacji');
		return inventoryDTO(db, inv);
	});
}

export interface CountInput {
	/** id istniejącej pozycji albo null dla produktu znalezionego dodatkowo */
	id: string | null;
	productId: string;
	batch: string | null;
	countedQty: number;
}

export function saveLocationCount(inventoryId: string, code: string, items: CountInput[]): Promise<void> {
	return mutate('Inwentaryzacja – zliczenie lokalizacji', (db) => {
		let inv = find(db.inventories, inventoryId);
		if (inv.status === 'DONE') throw new ApiError('VALIDATION', `${inv.number} jest zakończona`);
		let loc = inv.locations.find((l) => l.code === code);
		if (!loc) throw new ApiError('NOT_FOUND', `Lokalizacja ${code} nie należy do ${inv.number}`);
		if (items.some((i) => !(i.countedQty >= 0))) throw new ApiError('VALIDATION', 'Ilości muszą być ≥ 0');

		for (let input of items) {
			let item = input.id ? loc.items.find((i) => i.id === input.id) : null;
			if (item) item.countedQty = input.countedQty;
			else
				loc.items.push({
					id: `${inv.id}-x${Date.now().toString(36)}${loc.items.length}`,
					productId: input.productId,
					batch: input.batch?.trim().toUpperCase() || null,
					systemQty: 0,
					countedQty: input.countedQty,
					extra: true
				});
		}
		loc.countedAt = now();
		loc.countedBy = who();
		inv.status = 'IN_PROGRESS';
		inv.startedAt ??= now();
	});
}

/** Zakończenie: różnice wymagają PIN-u przełożonego, potem stany są korygowane */
export function finishInventory(id: string, approval?: { pin: string; note: string }): Promise<{ diffs: number }> {
	return mutate('Zakończenie inwentaryzacji', (db) => {
		let inv = find(db.inventories, id);
		let dto = inventoryDTO(db, inv);
		let missing = dto.locations.filter((l) => !l.counted);
		if (missing.length) throw new ApiError('VALIDATION', 'Nie wszystkie lokalizacje są policzone', missing.map((l) => l.code));
		if (dto.diffs.length) {
			if (!approval) throw new ApiError('APPROVAL_REQUIRED', 'Różnice inwentaryzacyjne wymagają zatwierdzenia przełożonego');
			let s = assertSupervisor(db, approval.pin);
			inv.approval = { by: s.name, at: now(), note: approval.note.trim() };
		}
		for (let d of dto.diffs) {
			let current = stockAt(db, inv.warehouseId, d.location, d.product.id, d.batch);
			let target = d.countedQty;
			if (target < current) takeStock(db, { warehouseId: inv.warehouseId, location: d.location, productId: d.product.id, qty: current - target, batch: d.batch });
			else if (target > current) addStock(db, { warehouseId: inv.warehouseId, location: d.location, productId: d.product.id, qty: target - current, batch: d.batch, expiry: null, serials: [] });
		}
		inv.status = 'DONE';
		inv.doneAt = now();
		return { diffs: dto.diffs.length };
	});
}
