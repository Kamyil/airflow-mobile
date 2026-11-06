import { getDb } from '$lib/mock/db';
import {
	carrierSpec,
	carriersOfSalesOrder,
	contentSignature,
	detailDTO,
	find,
	labelDTO,
	nextCarrierCode,
	packedQty,
	summaryDTO
} from '$lib/mock/domain';
import type { CarrierKind, CustomDimensions, LabelDTO, PickingOrderDetailDTO, PickingOrderSummaryDTO } from '$lib/types';
import { ApiError, mutate, now, query } from './core';

/** Kompletacja (z makiety warehouse-app) – logika bez zmian, tylko wpięta w nową apkę. */

function editablePickingOrder(pickingOrderId: string) {
	let db = getDb();
	let po = find(db.pickingOrders, pickingOrderId);
	if (po.releasedAt) throw new ApiError('VALIDATION', `${po.number} zostało już wydane – cofnij wydanie, aby je edytować`);
	return po;
}

// --- odczyt -------------------------------------------------------------------

/** Zlecenia do kompletacji – wydane przechodzą do widoku Wysyłka */
export function listPickingOrders(): Promise<PickingOrderSummaryDTO[]> {
	return query(() => {
		let db = getDb();
		return db.pickingOrders
			.filter((po) => !po.releasedAt)
			.map((po) => summaryDTO(db, po))
			.sort((a, b) => a.salesOrder.shipDate.localeCompare(b.salesOrder.shipDate) || a.number.localeCompare(b.number));
	});
}

export function getPickingOrder(id: string): Promise<PickingOrderDetailDTO> {
	return query(() => {
		let db = getDb();
		let po = db.pickingOrders.find((p) => p.id === id);
		if (!po) throw new ApiError('NOT_FOUND', 'Nie znaleziono zlecenia kompletacyjnego');
		return detailDTO(db, po);
	});
}

// --- etykiety -----------------------------------------------------------------

/**
 * Drukuje etykiety nośników (kod nośnika jako kod kreskowy). Kolejne wydruki to duplikaty.
 * `withContent` dokłada listę spakowanych produktów.
 */
export function printLabels(carrierIds: string[], opts: { withContent: boolean }): Promise<LabelDTO[]> {
	return mutate('Druk etykiet nośników', () => {
		let db = getDb();
		return carrierIds.map((id) => {
			let c = find(db.carriers, id);
			if (c.label) {
				c.label.printCount++;
				c.label.printedAt = now();
			} else {
				c.label = { printedAt: now(), printCount: 1 };
			}
			if (opts.withContent && c.items.length > 0) {
				c.contentLabel = { printedAt: now(), signature: contentSignature(c) };
			}
			return labelDTO(db, c, opts.withContent && c.items.length > 0);
		});
	});
}

// --- nośniki ------------------------------------------------------------------

export interface CarrierSpecInput {
	typeId: string | null;
	custom: CustomDimensions | null;
}

function validateSpec(spec: CarrierSpecInput) {
	if (spec.typeId) return;
	let d = spec.custom;
	if (!d) throw new ApiError('VALIDATION', 'Wybierz typ nośnika');
	let errors: string[] = [];
	if (!d.name.trim()) errors.push('Podaj nazwę nośnika');
	if (!(d.lengthCm > 0)) errors.push('Podaj długość');
	if (!(d.widthCm > 0)) errors.push('Podaj szerokość');
	if (!(d.heightCm > 0)) errors.push('Podaj wysokość');
	if (errors.length) throw new ApiError('VALIDATION', 'Uzupełnij wymiary nośnika', errors);
}

const KIND_LABEL: Record<CarrierKind, string> = { PALLET: 'palety', PARCEL: 'paczki' };

/** Bez transportów mieszanych: wszystkie nośniki zamówienia muszą być tego samego rodzaju */
function assertKind(salesOrderId: string, spec: CarrierSpecInput, ignoreCarrierId?: string) {
	let db = getDb();
	let others = carriersOfSalesOrder(db, salesOrderId).filter((c) => c.id !== ignoreCarrierId);
	if (!others.length) return;
	let expected = carrierSpec(db, others[0]).kind;
	let kind = carrierSpec(db, spec).kind;
	if (kind !== expected) throw new ApiError('VALIDATION', `Zamówienie ma już ${KIND_LABEL[expected]} – nie można mieszać z nośnikiem typu ${KIND_LABEL[kind]}`);
}

export function createCarrier(pickingOrderId: string, spec: CarrierSpecInput): Promise<{ carrierId: string; code: string }> {
	return mutate('Dodanie nośnika', () => {
		let db = getDb();
		let po = editablePickingOrder(pickingOrderId);
		validateSpec(spec);
		assertKind(po.salesOrderId, spec);

		let siblings = carriersOfSalesOrder(db, po.salesOrderId);
		let carrier = {
			id: `k-${String(db.counters.carrier++).padStart(2, '0')}`,
			code: nextCarrierCode(db),
			pickingOrderId,
			no: siblings.length + 1,
			typeId: spec.typeId,
			custom: spec.typeId ? null : spec.custom,
			proposedByOffice: false,
			items: [],
			weightOverrideKg: null,
			// nowy nośnik od razu dostaje wydrukowaną etykietę
			label: { printedAt: now(), printCount: 1 },
			contentLabel: null,
			stagedAt: null,
			dock: null,
			loadedAt: null
		};
		db.carriers.push(carrier);
		po.startedAt ??= now();

		return { carrierId: carrier.id, code: carrier.code };
	});
}

export interface CarrierUpdateInput extends CarrierSpecInput {
	weightOverrideKg: number | null;
}

/** Zmiana typu nośnika i wagi. Zawartości nie da się tu edytować – powstaje tylko przez skanowanie przy pakowaniu. */
export function updateCarrier(carrierId: string, input: CarrierUpdateInput): Promise<void> {
	return mutate('Edycja nośnika', () => {
		let db = getDb();
		let carrier = find(db.carriers, carrierId);
		let po = editablePickingOrder(carrier.pickingOrderId);
		validateSpec(input);
		assertKind(po.salesOrderId, input, carrier.id);
		if (input.weightOverrideKg !== null && !(input.weightOverrideKg > 0)) throw new ApiError('VALIDATION', 'Waga musi być większa od 0');

		carrier.typeId = input.typeId;
		carrier.custom = input.typeId ? null : input.custom;
		carrier.weightOverrideKg = input.weightOverrideKg;
	});
}

/** Usuwa nośnik; spakowane na nim produkty wracają do kolejki. Numeracja nośników w zamówieniu jest przeliczana. */
export function deleteCarrier(carrierId: string): Promise<void> {
	return mutate('Usunięcie nośnika', () => {
		let db = getDb();
		let carrier = find(db.carriers, carrierId);
		let po = editablePickingOrder(carrier.pickingOrderId);

		db.carriers = db.carriers.filter((c) => c.id !== carrierId);
		carriersOfSalesOrder(db, po.salesOrderId).forEach((c, i) => (c.no = i + 1));
	});
}

// --- kompletacja --------------------------------------------------------------

/** Pakowanie po zeskanowaniu: półka -> towar -> ilość -> nośnik (po kodzie nośnika) */
export function packLine(input: { pickingOrderId: string; lineId: string; carrierCode: string; qty: number }): Promise<{ carrierCode: string }> {
	return mutate('Spakowanie pozycji', () => {
		let db = getDb();
		let po = editablePickingOrder(input.pickingOrderId);
		let line = po.lines.find((l) => l.id === input.lineId);
		if (!line) throw new ApiError('NOT_FOUND', 'Nie znaleziono pozycji');

		let code = input.carrierCode.trim().toUpperCase();
		let carrier = db.carriers.find((c) => c.code === code);
		if (!carrier) throw new ApiError('VALIDATION', `Nieznany kod nośnika ${code}`);
		if (carrier.pickingOrderId !== po.id) throw new ApiError('VALIDATION', `Nośnik ${code} nie należy do ${po.number}`);
		if (!carrier.label) throw new ApiError('LABEL_REQUIRED', `Nośnik ${code} nie ma etykiety`);

		let remaining = line.qty - packedQty(db, line.id);
		if (!(input.qty > 0) || input.qty > remaining) throw new ApiError('VALIDATION', `Ilość musi być z zakresu 1–${remaining}`);

		let item = carrier.items.find((i) => i.lineId === line.id);
		if (item) item.qty += input.qty;
		else carrier.items.push({ lineId: line.id, qty: input.qty });

		if (input.qty === remaining) po.deferredLineIds = po.deferredLineIds.filter((id) => id !== line.id);
		po.startedAt ??= now();
		return { carrierCode: carrier.code };
	});
}

/** "Pomiń" – pozycja trafia na koniec kolejki */
export function deferLine(pickingOrderId: string, lineId: string): Promise<void> {
	return mutate('Pominięcie pozycji', () => {
		let po = editablePickingOrder(pickingOrderId);
		po.deferredLineIds = [...po.deferredLineIds.filter((id) => id !== lineId), lineId];
		po.startedAt ??= now();
	});
}

export function confirmPickingOrder(pickingOrderId: string): Promise<void> {
	return mutate('Potwierdzenie kompletacji', () => {
		let po = editablePickingOrder(pickingOrderId);
		po.startedAt ??= now();
		po.confirmedAt = now();
	});
}

export function releasePickingOrder(pickingOrderId: string): Promise<{ salesOrderNumber: string }> {
	return mutate('Wydanie kompletacji', () => {
		let db = getDb();
		let po = editablePickingOrder(pickingOrderId);
		let blockers = summaryDTO(db, po).releaseBlockers;
		if (blockers.length) throw new ApiError('RELEASE_BLOCKED', `Nie można wydać ${po.number}`, blockers);

		po.releasedAt = now();
		return { salesOrderNumber: find(db.salesOrders, po.salesOrderId).number };
	});
}
