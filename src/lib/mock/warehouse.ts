import type {
	Advice,
	AdviceDTO,
	AllocationDetailDTO,
	AllocationOrder,
	AllocationStatus,
	AllocationSummaryDTO,
	Db,
	Discrepancy,
	InventoryCount,
	InventoryDTO,
	InventoryLocationDTO,
	LocationStockDTO,
	Product,
	ProductFlags,
	PutawayLine,
	PutawayLineDTO,
	Receipt,
	ReceiptDTO,
	ReceiptLine,
	ReceiptLineDTO,
	StockItem,
	Transfer,
	TransferDTO,
	TransferLineDTO
} from '$lib/types';
import { find } from './domain';

/**
 * Logika "po stronie backendu" dla części magazynowej: awizacje, PZ, alokacja (zlecenia MWS),
 * przesunięcia, inwentaryzacja i stany. Widoki dostają gotowe DTO.
 */

const sum = <T>(list: T[], fn: (x: T) => number) => list.reduce((n, x) => n + fn(x), 0);

export function flagsOf(products: Product[]): ProductFlags {
	return {
		qc: products.some((p) => p.requiresQc),
		batch: products.some((p) => p.tracking === 'BATCH'),
		serial: products.some((p) => p.tracking === 'SERIAL')
	};
}

const nowHM = () => {
	let d = new Date();
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const today = () => {
	let d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- ZZ / awizacje -------------------------------------------------------------

/** Ile z pozycji ZZ zostało już przyjęte (tylko zamknięte PZ) */
export function receivedOnPoLine(db: Db, poLineId: string): number {
	return sum(
		db.receipts.filter((r) => r.status === 'DONE'),
		(r) => sum(r.lines.filter((l) => l.poLineId === poLineId), (l) => l.receivedQty)
	);
}

export function openReceiptOf(db: Db, adviceId: string): Receipt | null {
	return db.receipts.find((r) => r.adviceId === adviceId && r.status !== 'DONE') ?? null;
}

export function adviceDTO(db: Db, a: Advice): AdviceDTO {
	let pos = a.purchaseOrderIds.map((id) => find(db.purchaseOrders, id));
	let lines = pos.flatMap((po) => po.lines);
	let ordered = sum(lines, (l) => l.qty);
	let received = sum(lines, (l) => Math.min(l.qty, receivedOnPoLine(db, l.id)));
	let receipts = db.receipts.filter((r) => r.adviceId === a.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
	let open = openReceiptOf(db, a.id);
	let fully = receipts.some((r) => r.status === 'DONE') && received >= ordered;

	return {
		id: a.id,
		number: a.number,
		date: a.date,
		slotFrom: a.slotFrom,
		slotTo: a.slotTo,
		warehouse: find(db.warehouses, a.warehouseId),
		dock: find(db.docks, a.dockId),
		supplier: find(db.suppliers, a.supplierId),
		vehicle: a.vehicle,
		truckStatus: a.truckStatus,
		arrivedAt: a.arrivedAt,
		note: a.note,
		purchaseOrders: pos.map((po) => ({ id: po.id, number: po.number, lines: po.lines.length })),
		lines: lines.length,
		orderedQty: ordered,
		receivedQty: received,
		remainingQty: ordered - received,
		partiallyReceived: received > 0 && received < ordered,
		fullyReceived: fully,
		openReceipt: open ? { id: open.id, number: open.number, status: open.status } : null,
		receipts: receipts.map((r) => ({ id: r.id, number: r.number, status: r.status })),
		late: a.truckStatus === 'AWIZOWANE' && (a.date < today() || (a.date === today() && a.slotTo < nowHM())),
		flags: flagsOf(lines.map((l) => find(db.products, l.productId)))
	};
}

// --- PZ ------------------------------------------------------------------------

export function trackingMissing(p: Product, l: ReceiptLine): string | null {
	if (l.receivedQty === 0) return null;
	if (p.tracking === 'BATCH') {
		let covered = sum(l.batches, (b) => b.qty);
		if (covered !== l.receivedQty) return `Seria/partia: przypisano ${covered} z ${l.receivedQty}`;
	}
	if (p.tracking === 'SERIAL' && l.serials.length !== l.receivedQty) return `Numery seryjne: ${l.serials.length} z ${l.receivedQty}`;
	return null;
}

function lineDTO(db: Db, l: ReceiptLine): ReceiptLineDTO {
	let product = find(db.products, l.productId);
	return {
		...l,
		product,
		purchaseOrderNumber: find(db.purchaseOrders, l.purchaseOrderId).number,
		diff: l.receivedQty - l.expectedQty,
		checked: l.checkedAt !== null,
		trackingMissing: trackingMissing(product, l)
	};
}

export function discrepanciesOf(lines: ReceiptLineDTO[]): Discrepancy[] {
	return lines
		.filter((l) => l.checked && l.diff !== 0)
		.map((l) => ({ lineId: l.id, product: l.product, expected: l.expectedQty, received: l.receivedQty, diff: l.diff, note: l.note }));
}

export function allocationStatus(o: AllocationOrder): AllocationStatus {
	if (o.doneAt) return 'DONE';
	return o.startedAt || o.lines.some((l) => l.placements.length) ? 'IN_PROGRESS' : 'TODO';
}

export function receiptDTO(db: Db, r: Receipt): ReceiptDTO {
	let advice = find(db.advices, r.adviceId);
	let lines = r.lines.map((l) => lineDTO(db, l));
	let unchecked = lines.filter((l) => !l.checked);
	let tracking = lines.filter((l) => l.trackingMissing);
	let blockers: string[] = [];
	if (unchecked.length) blockers.push(`Niesprawdzone pozycje: ${unchecked.length}`);
	for (let l of tracking) blockers.push(`${l.product.sku} – ${l.trackingMissing}`);
	if (lines.every((l) => l.receivedQty === 0) && !unchecked.length) blockers.push('Nic nie przyjęto – PZ nie może być pusta');

	let alloc = r.allocationOrderId ? find(db.allocationOrders, r.allocationOrderId) : null;
	let pos = [...new Set(r.lines.map((l) => l.purchaseOrderId))].map((id) => find(db.purchaseOrders, id));

	return {
		id: r.id,
		number: r.number,
		status: r.status,
		advice: { id: advice.id, number: advice.number, slotFrom: advice.slotFrom, slotTo: advice.slotTo, date: advice.date, vehicle: advice.vehicle },
		warehouse: find(db.warehouses, r.warehouseId),
		dock: find(db.docks, r.dockId),
		supplier: find(db.suppliers, advice.supplierId),
		purchaseOrders: pos.map((p) => ({ id: p.id, number: p.number })),
		createdAt: r.createdAt,
		createdBy: r.createdBy,
		closedAt: r.closedAt,
		closedBy: r.closedBy,
		approval: r.approval,
		lines,
		progress: { lines: lines.length, linesChecked: lines.length - unchecked.length },
		totals: { expected: sum(lines, (l) => l.expectedQty), received: sum(lines, (l) => l.receivedQty) },
		discrepancies: discrepanciesOf(lines),
		blockers,
		allocation: alloc
			? {
					id: alloc.id,
					number: alloc.number,
					status: allocationStatus(alloc),
					lines: alloc.lines.length,
					linesDone: alloc.lines.filter((l) => placedQty(l) >= l.qty).length
				}
			: null,
		labelsPrintedAt: r.labelsPrintedAt,
		flags: flagsOf(lines.map((l) => l.product))
	};
}

// --- stany -----------------------------------------------------------------------

export function addStock(db: Db, item: Omit<StockItem, 'id'>) {
	let existing = db.stock.find(
		(s) => s.warehouseId === item.warehouseId && s.location === item.location && s.productId === item.productId && s.batch === item.batch
	);
	if (existing) {
		existing.qty += item.qty;
		existing.serials = [...existing.serials, ...item.serials];
		existing.expiry ??= item.expiry;
		return;
	}
	db.stock.push({ ...item, id: `st-${db.counters.stock++}` });
}

/** Zdejmuje ilość z lokalizacji (FIFO po partiach, gdy partia nie jest wskazana). Zwraca zdjęte wiersze. */
export function takeStock(
	db: Db,
	q: { warehouseId: string; location: string; productId: string; qty: number; batch?: string | null }
): Omit<StockItem, 'id'>[] {
	let rows = db.stock
		.filter((s) => s.warehouseId === q.warehouseId && s.location === q.location && s.productId === q.productId)
		.filter((s) => q.batch === undefined || q.batch === null || s.batch === q.batch)
		.sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'));
	let available = sum(rows, (r) => r.qty);
	if (available < q.qty) throw new Error(`Na ${q.location} jest tylko ${available} szt.`);

	let left = q.qty;
	let taken: Omit<StockItem, 'id'>[] = [];
	for (let row of rows) {
		if (left === 0) break;
		let n = Math.min(left, row.qty);
		row.qty -= n;
		left -= n;
		let serials = row.serials.slice(0, n);
		row.serials = row.serials.slice(n);
		taken.push({ warehouseId: row.warehouseId, location: row.location, productId: row.productId, qty: n, batch: row.batch, expiry: row.expiry, serials });
	}
	db.stock = db.stock.filter((s) => s.qty > 0);
	return taken;
}

export function stockAt(db: Db, warehouseId: string, location: string, productId: string, batch?: string | null): number {
	return sum(
		db.stock.filter((s) => s.warehouseId === warehouseId && s.location === location && s.productId === productId && (batch == null || s.batch === batch)),
		(s) => s.qty
	);
}

export function locationStockDTO(db: Db, warehouseId: string, code: string): LocationStockDTO | null {
	let location = db.locations.find((l) => l.warehouseId === warehouseId && l.code === code);
	if (!location) return null;
	return {
		location,
		items: db.stock
			.filter((s) => s.warehouseId === warehouseId && s.location === code)
			.map((s) => ({ ...s, product: find(db.products, s.productId) }))
	};
}

// --- alokacja (podpowiedzi Impulsa) ---------------------------------------------

const locSeq = (db: Db, warehouseId: string, code: string) => db.locations.find((l) => l.warehouseId === warehouseId && l.code === code)?.seq ?? 1e9;

/**
 * Podpowiedź lokalizacji (symulacja mechanizmu Impulsa): najpierw tam, gdzie produkt już leży
 * (dokładanie do istniejącego miejsca), w przeciwnym razie pierwsze wolne miejsce w strefie.
 */
export function suggestLocation(db: Db, warehouseId: string, productId: string): string {
	let existing = db.stock
		.filter((s) => s.warehouseId === warehouseId && s.productId === productId)
		.map((s) => db.locations.find((l) => l.warehouseId === warehouseId && l.code === s.location))
		.filter((l) => l && l.kind === 'STORAGE')
		.sort((a, b) => a!.seq - b!.seq)[0];
	if (existing) return existing.code;

	let product = find(db.products, productId);
	let zone = product.tracking === 'SERIAL' ? 'D' : product.unitWeightKg > 15 ? 'C' : warehouseId === 'mg02' ? 'P' : 'B';
	let occupied = new Set(db.stock.filter((s) => s.warehouseId === warehouseId).map((s) => s.location));
	let free = db.locations.filter((l) => l.warehouseId === warehouseId && l.kind === 'STORAGE' && l.zone === zone && !occupied.has(l.code)).sort((a, b) => a.seq - b.seq)[0];
	return free?.code ?? db.locations.find((l) => l.warehouseId === warehouseId && l.kind === 'STORAGE')!.code;
}

export const placedQty = (l: PutawayLine) => sum(l.placements, (p) => p.qty);

export function allocationSummaryDTO(db: Db, o: AllocationOrder): AllocationSummaryDTO {
	let receipt = find(db.receipts, o.receiptId);
	let advice = find(db.advices, receipt.adviceId);
	return {
		id: o.id,
		number: o.number,
		status: allocationStatus(o),
		receipt: { id: receipt.id, number: receipt.number },
		supplier: find(db.suppliers, advice.supplierId),
		warehouse: find(db.warehouses, o.warehouseId),
		createdAt: o.createdAt,
		startedAt: o.startedAt,
		doneAt: o.doneAt,
		progress: {
			lines: o.lines.length,
			linesDone: o.lines.filter((l) => placedQty(l) >= l.qty).length,
			qty: sum(o.lines, (l) => l.qty),
			qtyDone: sum(o.lines, (l) => Math.min(l.qty, placedQty(l)))
		},
		fromLocations: [...new Set(o.lines.map((l) => l.fromLocation))],
		flags: flagsOf(o.lines.map((l) => find(db.products, l.productId)))
	};
}

export function allocationDetailDTO(db: Db, o: AllocationOrder): AllocationDetailDTO {
	let ordered = [...o.lines].sort((a, b) => locSeq(db, o.warehouseId, a.suggestedLocation) - locSeq(db, o.warehouseId, b.suggestedLocation));
	let lines: PutawayLineDTO[] = ordered.map((l, i) => {
		let placed = placedQty(l);
		return { ...l, seq: i + 1, product: find(db.products, l.productId), placedQty: placed, remainingQty: Math.max(0, l.qty - placed), deferred: o.deferredLineIds.includes(l.id) };
	});
	let rank = (l: PutawayLineDTO) => (l.deferred ? 1 + o.deferredLineIds.indexOf(l.id) : 0);
	let queue = lines.filter((l) => l.remainingQty > 0).sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);
	return { ...allocationSummaryDTO(db, o), lines, queue, current: queue[0] ?? null };
}

// --- przesunięcia ------------------------------------------------------------------

export const movedQty = (l: Transfer['lines'][number]) => sum(l.moves, (m) => m.qty);

export function transferDTO(db: Db, t: Transfer): TransferDTO {
	let lines: TransferLineDTO[] = t.lines.map((l) => ({
		...l,
		product: find(db.products, l.productId),
		movedQty: movedQty(l),
		remainingQty: Math.max(0, l.qty - movedQty(l)),
		availableQty: stockAt(db, t.warehouseId, l.fromLocation, l.productId, l.batch)
	}));
	let ordered = [...lines].sort((a, b) => locSeq(db, t.warehouseId, a.fromLocation) - locSeq(db, t.warehouseId, b.fromLocation));
	let { lines: _, ...rest } = t;
	return {
		...rest,
		warehouse: find(db.warehouses, t.warehouseId),
		lines,
		progress: { lines: lines.length, linesDone: lines.filter((l) => l.remainingQty === 0).length },
		current: ordered.find((l) => l.remainingQty > 0) ?? null
	};
}

// --- inwentaryzacja ------------------------------------------------------------------

export function inventoryDTO(db: Db, inv: InventoryCount): InventoryDTO {
	let locations: InventoryLocationDTO[] = inv.locations
		.map((loc) => {
			let items = loc.items.map((i) => ({ ...i, product: find(db.products, i.productId), diff: i.countedQty === null ? null : i.countedQty - i.systemQty }));
			return {
				code: loc.code,
				items,
				counted: loc.countedAt !== null,
				countedAt: loc.countedAt,
				countedBy: loc.countedBy,
				diffs: items.filter((i) => i.diff !== null && i.diff !== 0).length
			};
		})
		.sort((a, b) => locSeq(db, inv.warehouseId, a.code) - locSeq(db, inv.warehouseId, b.code));

	let { locations: _, ...rest } = inv;
	return {
		...rest,
		warehouse: find(db.warehouses, inv.warehouseId),
		locations,
		progress: { locations: locations.length, counted: locations.filter((l) => l.counted).length },
		diffs: locations.flatMap((l) =>
			l.items
				.filter((i) => i.diff !== null && i.diff !== 0)
				.map((i) => ({ location: l.code, product: i.product, batch: i.batch, systemQty: i.systemQty, countedQty: i.countedQty!, diff: i.diff! }))
		)
	};
}
