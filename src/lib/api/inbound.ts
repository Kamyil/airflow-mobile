import { find } from '$lib/mock/domain';
import { addStock, adviceDTO, openReceiptOf, receiptDTO, receivedOnPoLine, suggestLocation } from '$lib/mock/warehouse';
import type { AdviceDetailDTO, AdviceDTO, BatchEntry, Db, GoodsLabelDTO, Receipt, ReceiptDTO, TruckStatus } from '$lib/types';
import { ApiError, latency, mutate, now, query, requireOnline, who } from './core';
import { assertSupervisor } from './session';

/** Dostawy: awizacje (Do przyjęcia) -> PZ (W trakcie) -> PZ zrealizowane (Przyjęte) -> zlecenie MWS (Alokacja) */

export interface AdviceFilter {
	date: string;
	warehouseId?: string | null;
	dockId?: string | null;
	truckStatus?: TruckStatus | null;
	/** Godzina początku okna, np. "08" */
	hour?: string | null;
	q?: string | null;
}

const match = (q: string | null | undefined, ...values: string[]) => !q?.trim() || values.some((v) => v.toLowerCase().includes(q.trim().toLowerCase()));

/** Awizacje na dzień – bez tych, które są już w całości przyjęte */
export function listAdvices(f: AdviceFilter): Promise<AdviceDTO[]> {
	return query((db) =>
		db.advices
			.filter((a) => a.date === f.date)
			.filter((a) => !f.warehouseId || a.warehouseId === f.warehouseId)
			.filter((a) => !f.dockId || a.dockId === f.dockId)
			.filter((a) => !f.truckStatus || a.truckStatus === f.truckStatus)
			.filter((a) => !f.hour || a.slotFrom.startsWith(f.hour))
			.map((a) => adviceDTO(db, a))
			.filter((a) => !a.fullyReceived)
			.filter((a) => match(f.q, a.number, a.supplier.name, a.vehicle.plate, a.vehicle.driver, ...a.purchaseOrders.map((p) => p.number)))
			.sort((a, b) => a.slotFrom.localeCompare(b.slotFrom) || a.number.localeCompare(b.number))
	);
}

export function getAdvice(id: string): Promise<AdviceDetailDTO> {
	return query((db) => {
		let a = db.advices.find((x) => x.id === id);
		if (!a) throw new ApiError('NOT_FOUND', 'Nie znaleziono awizacji');
		let items = a.purchaseOrderIds.flatMap((poId) => {
			let po = find(db.purchaseOrders, poId);
			return po.lines.map((l) => {
				let p = find(db.products, l.productId);
				return { product: p.name, sku: p.sku, ordered: l.qty, received: receivedOnPoLine(db, l.id), poNumber: po.number };
			});
		});
		return { ...adviceDTO(db, a), items };
	});
}

export function setTruckStatus(adviceId: string, status: TruckStatus): Promise<void> {
	return mutate('Zmiana statusu auta', (db) => {
		let a = find(db.advices, adviceId);
		a.truckStatus = status;
		if (status !== 'AWIZOWANE') a.arrivedAt ??= now();
		else a.arrivedAt = null;
	});
}

/** Wybór awizacji -> tworzy PZ z pozycjami pozostałymi do przyjęcia ze wszystkich ZZ awizacji */
export function startReceipt(adviceId: string): Promise<{ receiptId: string; created: boolean }> {
	return mutate('Utworzenie PZ', (db) => {
		let a = find(db.advices, adviceId);
		let open = openReceiptOf(db, adviceId);
		if (open) return { receiptId: open.id, created: false };

		let lines = a.purchaseOrderIds.flatMap((poId) =>
			find(db.purchaseOrders, poId).lines.map((l) => ({ poId, line: l, remaining: l.qty - receivedOnPoLine(db, l.id) }))
		);
		lines = lines.filter((l) => l.remaining > 0);
		if (!lines.length) throw new ApiError('VALIDATION', 'Wszystkie pozycje awizacji zostały już przyjęte');

		let seq = db.counters.receipt++;
		let id = `pz-${String(seq).padStart(4, '0')}`;
		let ym = now().slice(0, 7).replace('-', '/');
		db.receipts.push({
			id,
			number: `PZ/${ym}/${String(seq).padStart(4, '0')}`,
			adviceId,
			warehouseId: a.warehouseId,
			dockId: a.dockId,
			status: 'NEW',
			createdAt: now(),
			createdBy: who(),
			closedAt: null,
			closedBy: null,
			lines: lines.map((l, i) => ({
				id: `${id}-${i + 1}`,
				purchaseOrderId: l.poId,
				poLineId: l.line.id,
				productId: l.line.productId,
				expectedQty: l.remaining,
				receivedQty: 0,
				batches: [],
				serials: [],
				note: null,
				checkedAt: null
			})),
			approval: null,
			allocationOrderId: null,
			labelsPrintedAt: null
		});
		if (a.truckStatus !== 'POD_DOKIEM') {
			a.truckStatus = 'POD_DOKIEM';
			a.arrivedAt ??= now();
		}
		return { receiptId: id, created: true };
	});
}

export interface ReceiptFilter {
	status: 'OPEN' | 'DONE';
	warehouseId?: string | null;
	dockId?: string | null;
	date?: string | null;
	q?: string | null;
}

export function listReceipts(f: ReceiptFilter): Promise<ReceiptDTO[]> {
	return query((db) =>
		db.receipts
			.filter((r) => (f.status === 'DONE' ? r.status === 'DONE' : r.status !== 'DONE'))
			.filter((r) => !f.warehouseId || r.warehouseId === f.warehouseId)
			.filter((r) => !f.dockId || r.dockId === f.dockId)
			.filter((r) => !f.date || (r.closedAt ?? r.createdAt).startsWith(f.date))
			.map((r) => receiptDTO(db, r))
			.filter((r) => match(f.q, r.number, r.supplier.name, r.advice.number, r.advice.vehicle.plate, ...r.purchaseOrders.map((p) => p.number)))
			.sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt))
	);
}

export function getReceipt(id: string): Promise<ReceiptDTO> {
	return query((db) => {
		let r = db.receipts.find((x) => x.id === id);
		if (!r) throw new ApiError('NOT_FOUND', 'Nie znaleziono PZ');
		return receiptDTO(db, r);
	});
}

function editableReceipt(db: Db, id: string): Receipt {
	let r = find(db.receipts, id);
	if (r.status === 'DONE') throw new ApiError('VALIDATION', `${r.number} jest już zrealizowana`);
	return r;
}

/** Skan EAN / indeksu na PZ – zwraca pozycję, której dotyczy */
export function scanReceiptProduct(receiptId: string, code: string): Promise<{ lineId: string }> {
	return query((db) => {
		let r = find(db.receipts, receiptId);
		let c = code.trim().toUpperCase();
		let lines = r.lines.filter((l) => {
			let p = find(db.products, l.productId);
			return p.ean === c || p.sku.toUpperCase() === c;
		});
		if (!lines.length) throw new ApiError('VALIDATION', `Produkt ${c} nie występuje na tej dostawie`, ['Sprawdź, czy towar nie przyjechał omyłkowo – odłóż go na bok i zgłoś przełożonemu.']);
		// gdy ten sam produkt jest na kilku ZZ – pierwsza niesprawdzona pozycja
		return { lineId: (lines.find((l) => !l.checkedAt) ?? lines[0]).id };
	});
}

export interface ReceiptLineInput {
	receivedQty: number;
	batches: BatchEntry[];
	serials: string[];
	note: string | null;
}

export function updateReceiptLine(receiptId: string, lineId: string, input: ReceiptLineInput): Promise<void> {
	return mutate('Przyjęcie pozycji PZ', (db) => {
		let r = editableReceipt(db, receiptId);
		let line = r.lines.find((l) => l.id === lineId);
		if (!line) throw new ApiError('NOT_FOUND', 'Nie znaleziono pozycji');
		let p = find(db.products, line.productId);
		let errors: string[] = [];

		if (!(input.receivedQty >= 0) || !Number.isInteger(input.receivedQty)) errors.push('Ilość musi być liczbą całkowitą ≥ 0');
		let batches = p.tracking === 'BATCH' ? input.batches.filter((b) => b.qty > 0) : [];
		for (let b of batches) if (!b.batch.trim()) errors.push('Podaj numer serii dla każdej partii');
		let serials = p.tracking === 'SERIAL' ? input.serials.map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
		if (new Set(serials).size !== serials.length) errors.push('Numery seryjne nie mogą się powtarzać');
		let elsewhere = new Set(db.stock.flatMap((s) => (s.productId === p.id ? s.serials : [])));
		let dup = serials.filter((s) => elsewhere.has(s));
		if (dup.length) errors.push(`Numer seryjny jest już na stanie: ${dup.join(', ')}`);
		if (errors.length) throw new ApiError('VALIDATION', 'Popraw dane pozycji', errors);

		line.receivedQty = input.receivedQty;
		line.batches = batches.map((b) => ({ ...b, batch: b.batch.trim().toUpperCase() }));
		line.serials = serials;
		line.note = input.note?.trim() || null;
		line.checkedAt = now();
		r.status = 'IN_PROGRESS';
		r.approval = null;
	});
}

/** Rozbieżności bez przełożonego na miejscu – PZ czeka na akceptację */
export function requestApproval(receiptId: string): Promise<void> {
	return mutate('Wysłanie PZ do akceptacji', (db) => {
		let r = editableReceipt(db, receiptId);
		let dto = receiptDTO(db, r);
		if (dto.blockers.length) throw new ApiError('VALIDATION', 'Najpierw uzupełnij PZ', dto.blockers);
		r.status = 'AWAITING_APPROVAL';
	});
}

/**
 * "Zakończ przyjęcie": zamyka PZ, towar trafia na miejsce odstawcze DOKu,
 * a Impuls generuje zlecenie magazynowe MWS (alokacja). Rozbieżności wymagają PIN-u przełożonego.
 */
export async function closeReceipt(receiptId: string, approval?: { pin: string; note: string }): Promise<{ allocationOrderId: string; number: string }> {
	requireOnline('generowanie zlecenia magazynowego MWS w Impulsie');
	await latency(1400, 700); // wywołanie funkcji Impulsa trwa dłużej
	return mutate('Zamknięcie PZ', (db) => {
		let r = editableReceipt(db, receiptId);
		let dto = receiptDTO(db, r);
		if (dto.blockers.length) throw new ApiError('VALIDATION', `Nie można zamknąć ${r.number}`, dto.blockers);

		if (dto.discrepancies.length) {
			if (!approval) throw new ApiError('APPROVAL_REQUIRED', 'Rozbieżności wymagają zatwierdzenia przełożonego');
			let supervisor = assertSupervisor(db, approval.pin);
			r.approval = { by: supervisor.name, at: now(), note: approval.note.trim() };
		}

		let dock = find(db.docks, r.dockId);
		for (let l of r.lines) {
			if (l.receivedQty === 0) continue;
			let p = find(db.products, l.productId);
			let parts = p.tracking === 'BATCH' ? l.batches.map((b) => ({ qty: b.qty, batch: b.batch, expiry: b.expiry, serials: [] as string[] })) : [{ qty: l.receivedQty, batch: null, expiry: null, serials: l.serials }];
			for (let part of parts) addStock(db, { warehouseId: r.warehouseId, location: dock.stagingLocation, productId: l.productId, ...part });
		}

		// --- Impuls: "generuj zlecenie magazynowe MWS" ---
		let seq = db.counters.allocation++;
		let id = `zm-${String(seq).padStart(4, '0')}`;
		let number = `ZM/${now().slice(0, 4)}/${String(seq).padStart(4, '0')}`;
		let lines = r.lines
			.filter((l) => l.receivedQty > 0)
			.flatMap((l) => {
				let p = find(db.products, l.productId);
				let parts = p.tracking === 'BATCH' ? l.batches.map((b) => ({ qty: b.qty, batch: b.batch, expiry: b.expiry, serials: [] as string[] })) : [{ qty: l.receivedQty, batch: null, expiry: null, serials: l.serials }];
				return parts.map((part) => ({ productId: l.productId, ...part }));
			})
			.map((l, i) => ({
				id: `${id}-${i + 1}`,
				...l,
				fromLocation: dock.stagingLocation,
				suggestedLocation: suggestLocation(db, r.warehouseId, l.productId),
				placements: []
			}));
		db.allocationOrders.push({ id, number, receiptId: r.id, warehouseId: r.warehouseId, createdAt: now(), startedAt: null, doneAt: null, lines, deferredLineIds: [] });

		r.status = 'DONE';
		r.closedAt = now();
		r.closedBy = who();
		r.allocationOrderId = id;
		return { allocationOrderId: id, number };
	});
}

/** Etykiety towarowe dla przyjętego towaru: jedna na partię / numer seryjny / pozycję */
export function printReceiptLabels(receiptId: string): Promise<GoodsLabelDTO[]> {
	return mutate('Druk etykiet PZ', (db) => {
		let r = find(db.receipts, receiptId);
		if (r.status !== 'DONE') throw new ApiError('VALIDATION', 'Etykiety drukuje się po zamknięciu PZ');
		let supplier = find(db.suppliers, find(db.advices, r.adviceId).supplierId).name;
		let location = find(db.docks, r.dockId).stagingLocation;
		r.labelsPrintedAt = now();
		let base = { receiptNumber: r.number, supplier, location, printedAt: now() };
		return r.lines
			.filter((l) => l.receivedQty > 0)
			.flatMap((l): GoodsLabelDTO[] => {
				let product = find(db.products, l.productId);
				if (product.tracking === 'SERIAL') return l.serials.map((s) => ({ ...base, id: `${l.id}-${s}`, product, qty: 1, batch: null, expiry: null, serial: s }));
				if (product.tracking === 'BATCH') return l.batches.map((b) => ({ ...base, id: `${l.id}-${b.batch}`, product, qty: b.qty, batch: b.batch, expiry: b.expiry, serial: null }));
				return [{ ...base, id: l.id, product, qty: l.receivedQty, batch: null, expiry: null, serial: null }];
			});
	});
}

