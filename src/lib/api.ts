import { commit, getDb, reset } from '$lib/mock/db';
import {
	carrierSpec,
	carriersOfSalesOrder,
	contentSignature,
	detailDTO,
	find,
	forwarderOf,
	labelDTO,
	nextCarrierCode,
	packedQty,
	readiness,
	shipmentDTO,
	summaryDTO
} from '$lib/mock/domain';
import type { CarrierKind, CustomDimensions, LabelDTO, OrderReadiness, PickingOrderDetailDTO, PickingOrderSummaryDTO, ShipmentDTO } from '$lib/types';

/**
 * Warstwa API makiety. Zachowuje się jak klient backendu: asynchronicznie, z opóźnieniem,
 * zwraca kopie danych i rzuca `ApiError` przy błędach walidacji.
 * Podpięcie prawdziwego backendu = podmiana implementacji tych funkcji.
 */

export type ApiErrorCode = 'VALIDATION' | 'LABEL_REQUIRED' | 'RELEASE_BLOCKED' | 'NOT_FOUND';

export class ApiError extends Error {
	constructor(
		public code: ApiErrorCode,
		message: string,
		public details: string[] = []
	) {
		super(message);
	}
}

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);

async function query<T>(fn: () => T): Promise<T> {
	await latency();
	return clone(fn());
}

async function mutate<T>(fn: () => T): Promise<T> {
	await latency();
	let result = fn();
	commit();
	return clone(result);
}

function editablePickingOrder(pickingOrderId: string) {
	let db = getDb();
	let po = find(db.pickingOrders, pickingOrderId);
	if (po.releasedAt) throw new ApiError('VALIDATION', `${po.number} zostało już wydane – cofnij wydanie, aby je edytować`);
	return po;
}

// --- odczyt -------------------------------------------------------------------

export function getContext() {
	return query(() => {
		let db = getDb();
		return {
			operator: db.operator,
			counts: {
				picking: db.pickingOrders.filter((po) => !po.releasedAt).length,
				dispatch: new Set(db.pickingOrders.filter((po) => po.releasedAt && !po.shippedAt).map((po) => po.salesOrderId)).size
			}
		};
	});
}

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

/** Zamówienia, które mają co najmniej jedną wydaną (a niewysłaną) kompletację */
export function listDispatchOrders(filter: { salesOrderNumber?: string | null } = {}): Promise<OrderReadiness[]> {
	return query(() => {
		let db = getDb();
		let soIds = new Set(db.pickingOrders.filter((po) => po.releasedAt && !po.shippedAt).map((po) => po.salesOrderId));
		return db.salesOrders
			.filter((so) => soIds.has(so.id))
			.filter((so) => !filter.salesOrderNumber || so.number === filter.salesOrderNumber)
			.map((so) => readiness(db, so))
			.sort((a, b) => a.salesOrder.shipDate.localeCompare(b.salesOrder.shipDate) || a.salesOrder.number.localeCompare(b.salesOrder.number));
	});
}

export function listShipments(): Promise<ShipmentDTO[]> {
	return query(() => {
		let db = getDb();
		return db.shipments.map((s) => shipmentDTO(db, s)).sort((a, b) => b.closedAt.localeCompare(a.closedAt));
	});
}

// --- etykiety -----------------------------------------------------------------

/**
 * Drukuje etykiety nośników (kod nośnika jako kod kreskowy). Kolejne wydruki to duplikaty.
 * `withContent` dokłada listę spakowanych produktów.
 */
export function printLabels(carrierIds: string[], opts: { withContent: boolean }): Promise<LabelDTO[]> {
	return mutate(() => {
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
	return mutate(() => {
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
			dock: null
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
	return mutate(() => {
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
	return mutate(() => {
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
	return mutate(() => {
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
	return mutate(() => {
		let po = editablePickingOrder(pickingOrderId);
		po.deferredLineIds = [...po.deferredLineIds.filter((id) => id !== lineId), lineId];
		po.startedAt ??= now();
	});
}

export function confirmPickingOrder(pickingOrderId: string): Promise<void> {
	return mutate(() => {
		let po = editablePickingOrder(pickingOrderId);
		po.startedAt ??= now();
		po.confirmedAt = now();
	});
}

export function releasePickingOrder(pickingOrderId: string): Promise<{ salesOrderNumber: string }> {
	return mutate(() => {
		let db = getDb();
		let po = editablePickingOrder(pickingOrderId);
		let blockers = summaryDTO(db, po).releaseBlockers;
		if (blockers.length) throw new ApiError('RELEASE_BLOCKED', `Nie można wydać ${po.number}`, blockers);

		po.releasedAt = now();
		return { salesOrderNumber: find(db.salesOrders, po.salesOrderId).number };
	});
}

export function revertRelease(pickingOrderId: string): Promise<void> {
	return mutate(() => {
		let db = getDb();
		let po = find(db.pickingOrders, pickingOrderId);
		if (po.shippedAt) throw new ApiError('VALIDATION', 'Zlecenie zostało już wysłane');
		po.releasedAt = null;
		for (let c of db.carriers.filter((c) => c.pickingOrderId === po.id)) {
			c.stagedAt = null;
			c.dock = null;
		}
	});
}

// --- przygotowanie i zamknięcie wysyłki ---------------------------------------

/**
 * Przygotowanie do wysyłki: wydruk etykiet (z zawartością) wydanych nośników.
 * Wydrukowany nośnik jest przygotowany – trafia na miejsce odbioru swojego spedytora.
 */
export function printShippingLabels(carrierIds: string[]): Promise<LabelDTO[]> {
	return mutate(() => {
		let db = getDb();
		return carrierIds.map((id) => {
			let c = find(db.carriers, id);
			let po = find(db.pickingOrders, c.pickingOrderId);
			if (!po.releasedAt) throw new ApiError('VALIDATION', `${po.number} nie zostało wydane`);

			c.label = c.label ? { printedAt: now(), printCount: c.label.printCount + 1 } : { printedAt: now(), printCount: 1 };
			c.contentLabel = { printedAt: now(), signature: contentSignature(c) };
			c.stagedAt ??= now();
			c.dock ??= forwarderOf(db, po.salesOrderId)!.defaultDock;
			return labelDTO(db, c, c.items.length > 0);
		});
	});
}

/**
 * Zamknięcie dnia: wszystkie gotowe zamówienia (wydane, z wydrukowanymi etykietami)
 * są wysyłane – powstaje jedna wysyłka na spedytora. Niegotowe czekają na kolejny dzień.
 */
export function closeDay(): Promise<ShipmentDTO[]> {
	return mutate(() => {
		let db = getDb();
		let soIds = new Set(db.pickingOrders.filter((po) => po.releasedAt && !po.shippedAt).map((po) => po.salesOrderId));
		let ready = db.salesOrders.filter((so) => soIds.has(so.id)).map((so) => readiness(db, so)).filter((o) => o.ready);
		if (!ready.length) throw new ApiError('VALIDATION', 'Brak gotowych zamówień do zamknięcia');

		let byForwarder = new Map<string, typeof ready>();
		for (let o of ready) byForwarder.set(o.forwarder.id, [...(byForwarder.get(o.forwarder.id) ?? []), o]);

		return [...byForwarder.entries()].map(([forwarderId, orders]) => {
			let seq = db.counters.shipment++;
			let shipment = {
				id: `sh-${seq}`,
				number: `WYS/2026/${String(seq).padStart(4, '0')}`,
				forwarderId,
				salesOrderIds: orders.map((o) => o.salesOrder.id),
				carrierIds: orders.flatMap((o) => o.pickingOrders.flatMap((p) => p.carriers.map((c) => c.id))),
				waybillNo: `${forwarderId.slice(0, 3).toUpperCase()}-${Math.floor(7_000_000_000 + Math.random() * 999_999_999)}`,
				closedAt: now()
			};
			db.shipments.push(shipment);
			for (let po of db.pickingOrders.filter((p) => shipment.salesOrderIds.includes(p.salesOrderId) && p.releasedAt)) {
				po.shippedAt = shipment.closedAt;
				po.shipmentId = shipment.id;
			}
			return shipmentDTO(db, shipment);
		});
	});
}

// --- narzędzia makiety --------------------------------------------------------

export async function resetMockData(): Promise<void> {
	await latency();
	reset();
}

