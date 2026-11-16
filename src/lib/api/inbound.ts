import { find } from '$lib/mock/domain';
import { addStock, adviceDTO, openReceiptOf, receiptDTO, receivedOnPoLine, suggestLocation } from '$lib/mock/warehouse';
import type { AdviceDetailDTO, AdviceDTO, Db, GoodsLabelDTO, Receipt, ReceiptDocumentKind, ReceiptDTO } from '$lib/types';
import { ApiError, latency, mutate, now, query, requireOnline, who } from './core';
import { assertSupervisor } from './session';

/** Dostawy: awizacje (Do przyjęcia) -> PZ (W trakcie) -> PZ do realizacji (Przyjęte; zamyka się sama) -> zlecenie MWS (Alokacja) */

export interface AdviceFilter {
	/** Dni dostawy (YYYY-MM-DD) – wybór wielokrotny: wczoraj / dziś / jutro */
	dates: string[];
	warehouseId?: string | null;
	dockId?: string | null;
	q?: string | null;
}

const match = (q: string | null | undefined, ...values: string[]) => !q?.trim() || values.some((v) => v.toLowerCase().includes(q.trim().toLowerCase()));

/**
 * Do przyjęcia: awizacje z wybranych dni, na których nic się teraz nie dzieje.
 * Pomija w całości przyjęte oraz te z otwartą PZ (są w zakładce W trakcie).
 */
export function listAdvices(f: AdviceFilter): Promise<AdviceDTO[]> {
	return query((db) =>
		db.advices
			.filter((a) => f.dates.includes(a.date))
			.filter((a) => !f.warehouseId || a.warehouseId === f.warehouseId)
			.filter((a) => !f.dockId || a.dockId === f.dockId)
			.map((a) => adviceDTO(db, a))
			.filter((a) => !a.fullyReceived && !a.openReceipt)
			.filter((a) => match(f.q, a.number, a.supplier.name, a.vehicle.plate, a.vehicle.driver, ...a.purchaseOrders.map((p) => p.number)))
			.sort((a, b) => a.date.localeCompare(b.date) || a.slotFrom.localeCompare(b.slotFrom) || a.number.localeCompare(b.number))
	);
}

export function getAdvice(id: string): Promise<AdviceDetailDTO> {
	return query((db) => {
		let a = db.advices.find((x) => x.id === id);
		if (!a) throw new ApiError('NOT_FOUND', 'Nie znaleziono awizacji');
		let items = a.purchaseOrderIds.flatMap((poId) => {
			let po = find(db.purchaseOrders, poId);
			return po.lines
				.map((l) => ({ product: find(db.products, l.productId), ordered: l.qty, remaining: l.qty - receivedOnPoLine(db, l.id), poNumber: po.number }))
				.filter((l) => l.remaining > 0);
		});
		return { ...adviceDTO(db, a), items };
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
			mwsSkipped: false,
			labelsPrintedAt: null,
			documents: []
		});
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
	if (r.status === 'DONE') throw new ApiError('VALIDATION', `Rozładunek ${r.number} jest już zakończony`);
	return r;
}

/** Rozładunek: liczba przyjętych nośników (palet) – jedyne dane wprowadzane przez magazyniera */
export function setReceiptCarriers(receiptId: string, carriers: number): Promise<void> {
	return mutate('Liczba nośników na PZ', (db) => {
		let r = editableReceipt(db, receiptId);
		if (!Number.isInteger(carriers) || carriers < 0) throw new ApiError('VALIDATION', 'Liczba nośników musi być liczbą całkowitą ≥ 0');
		r.carriers = carriers;
		if (r.status === 'NEW') r.status = 'IN_PROGRESS';
	});
}

/** Rozbieżności bez przełożonego na miejscu – PZ czeka na akceptację */
export function requestApproval(receiptId: string, generateMws: boolean): Promise<void> {
	return mutate('Wysłanie PZ do akceptacji', (db) => {
		let r = editableReceipt(db, receiptId);
		r.status = 'AWAITING_APPROVAL';
		r.pendingMws = generateMws;
	});
}

/**
 * "Zakończ rozładunek": PZ -> Do realizacji, towar trafia na miejsce odstawcze DOKu,
 * a Impuls generuje zlecenie magazynowe MWS (alokacja). Rozbieżności wymagają PIN-u przełożonego.
 */
export interface CloseReceiptOptions {
	/** PIN + uwaga przełożonego, gdy są rozbieżności */
	approval?: { pin: string; note: string };
	/** false = zamknij PZ bez wywołania Impulsa "generuj zlecenie magazynowe MWS" */
	generateMws: boolean;
}

/** Zakończenie przyjęcia: PZ -> Do realizacji (nie zamyka jej), towar na miejsce odstawcze DOKu, opcjonalnie Impuls generuje zlecenie MWS */
export async function closeReceipt(receiptId: string, opts: CloseReceiptOptions): Promise<{ allocationOrderId: string | null; number: string | null }> {
	requireOnline(opts.generateMws ? 'generowanie zlecenia magazynowego MWS w Impulsie' : 'zakończenie rozładunku w Impulsie');
	await latency(opts.generateMws ? 1400 : 700, 500); // wywołanie funkcji Impulsa trwa dłużej
	return mutate(opts.generateMws ? 'Zakończenie rozładunku' : 'Zakończenie rozładunku bez zlecenia MWS', (db) => {
		let r = editableReceipt(db, receiptId);
		let dto = receiptDTO(db, r);

		if (dto.needsApproval) {
			if (!opts.approval) throw new ApiError('APPROVAL_REQUIRED', 'Różnica nośników wymaga zatwierdzenia przełożonego');
			let supervisor = assertSupervisor(db, opts.approval.pin);
			r.approval = { by: supervisor.name, at: now(), note: opts.approval.note.trim() };
		}

		// bez wprowadzania produktów: PZ przyjmuje ilości z dokumentu (weryfikacja ilości poza rozładunkiem)
		for (let l of r.lines) {
			l.receivedQty = l.expectedQty;
			l.checkedAt ??= now();
		}

		let dock = find(db.docks, r.dockId);
		for (let part of receivedParts(db, r)) addStock(db, { warehouseId: r.warehouseId, location: dock.stagingLocation, ...part });

		r.status = 'DONE';
		delete r.pendingMws;
		r.closedAt = now();
		r.closedBy = who();
		if (!opts.generateMws) {
			r.mwsSkipped = true;
			return { allocationOrderId: null, number: null };
		}
		return createAllocationOrder(db, r);
	});
}

/** PZ zamknięta bez zlecenia MWS – wygeneruj je jednak później */
export async function generateMwsOrder(receiptId: string): Promise<{ allocationOrderId: string; number: string }> {
	requireOnline('generowanie zlecenia magazynowego MWS w Impulsie');
	await latency(1400, 700);
	return mutate('Generowanie zlecenia MWS', (db) => {
		let r = find(db.receipts, receiptId);
		if (r.status !== 'DONE') throw new ApiError('VALIDATION', 'Najpierw zakończ przyjęcie');
		if (r.allocationOrderId) throw new ApiError('VALIDATION', 'Zlecenie MWS już istnieje');
		return createAllocationOrder(db, r);
	});
}

/** Przyjęty towar w podziale na partie / numery seryjne */
function receivedParts(db: Db, r: Receipt) {
	return r.lines
		.filter((l) => l.receivedQty > 0)
		.flatMap((l) => {
			let p = find(db.products, l.productId);
			let parts = p.tracking === 'BATCH' ? l.batches.map((b) => ({ qty: b.qty, batch: b.batch, expiry: b.expiry, serials: [] as string[] })) : [{ qty: l.receivedQty, batch: null, expiry: null, serials: l.serials }];
			return parts.map((part) => ({ productId: l.productId, ...part }));
		});
}

/** Impuls: "generuj zlecenie magazynowe MWS" – z miejsca odstawczego na półki */
function createAllocationOrder(db: Db, r: Receipt): { allocationOrderId: string; number: string } {
	let dock = find(db.docks, r.dockId);
	let seq = db.counters.allocation++;
	let id = `zm-${String(seq).padStart(4, '0')}`;
	let number = `ZM/${now().slice(0, 4)}/${String(seq).padStart(4, '0')}`;
	let lines = receivedParts(db, r).map((l, i) => ({
		id: `${id}-${i + 1}`,
		...l,
		fromLocation: dock.stagingLocation,
		suggestedLocation: suggestLocation(db, r.warehouseId, l.productId),
		placements: []
	}));
	db.allocationOrders.push({ id, number, receiptId: r.id, warehouseId: r.warehouseId, createdAt: now(), startedAt: null, doneAt: null, lines, deferredLineIds: [] });
	r.allocationOrderId = id;
	r.mwsSkipped = false;
	return { allocationOrderId: id, number };
}

/**
 * Korekta serii / daty ważności – także po zamknięciu PZ (np. pomyłka przy przepisywaniu z etykiety).
 * Ilości się nie zmieniają; poprawka idzie na pozycję PZ, stany magazynowe i zlecenie MWS.
 */
export function correctReceiptBatch(receiptId: string, lineId: string, index: number, input: { batch: string; expiry: string | null }): Promise<void> {
	return mutate('Korekta serii', (db) => {
		let r = find(db.receipts, receiptId);
		let line = r.lines.find((l) => l.id === lineId);
		let entry = line?.batches[index];
		if (!line || !entry) throw new ApiError('NOT_FOUND', 'Nie znaleziono serii na pozycji');
		let batch = input.batch.trim().toUpperCase();
		if (!batch) throw new ApiError('VALIDATION', 'Podaj numer serii');
		if (batch === entry.batch && input.expiry === entry.expiry) throw new ApiError('VALIDATION', 'Nic się nie zmieniło');
		if (batch !== entry.batch && line.batches.some((b, i) => i !== index && b.batch === batch)) throw new ApiError('VALIDATION', `Seria ${batch} jest już na tej pozycji`);

		let old = { batch: entry.batch, expiry: entry.expiry };
		entry.batch = batch;
		entry.expiry = input.expiry;
		(line.batchCorrections ??= []).push({ from: old.batch, to: batch, expiryFrom: old.expiry, expiryTo: input.expiry, by: who(), at: now() });

		// stany: wiersze tej partii w magazynie PZ (miejsce odstawcze albo już na półkach)
		for (let s of db.stock.filter((s) => s.warehouseId === r.warehouseId && s.productId === line.productId && s.batch === old.batch)) {
			s.batch = batch;
			s.expiry = input.expiry;
		}
		// zlecenie MWS (alokacja) wygenerowane z tej PZ
		let zm = r.allocationOrderId ? db.allocationOrders.find((o) => o.id === r.allocationOrderId) : null;
		for (let l of zm?.lines.filter((l) => l.productId === line.productId && l.batch === old.batch) ?? []) {
			l.batch = batch;
			l.expiry = input.expiry;
		}
	});
}

/** Zdjęcia dokumentów dostawy (WZ, CMR, faktura…) – na poziomie PZ */
export function addReceiptDocuments(receiptId: string, kind: ReceiptDocumentKind, photos: string[]): Promise<void> {
	return mutate('Dodanie dokumentów do PZ', (db) => {
		if (!photos.length) throw new ApiError('VALIDATION', 'Zrób co najmniej jedno zdjęcie');
		let r = find(db.receipts, receiptId);
		for (let src of photos) r.documents.push({ id: `doc-${db.counters.photo++}`, kind, src, takenAt: now(), by: who() });
	});
}

export function removeReceiptDocument(receiptId: string, documentId: string): Promise<void> {
	return mutate('Usunięcie dokumentu z PZ', (db) => {
		let r = find(db.receipts, receiptId);
		r.documents = r.documents.filter((d) => d.id !== documentId);
	});
}

/** Etykiety towarowe dla przyjętego towaru: jedna na partię / numer seryjny / pozycję */
export function printReceiptLabels(receiptId: string): Promise<GoodsLabelDTO[]> {
	return mutate('Druk etykiet PZ', (db) => {
		let r = find(db.receipts, receiptId);
		if (r.status !== 'DONE') throw new ApiError('VALIDATION', 'Etykiety drukuje się po zakończeniu rozładunku');
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

