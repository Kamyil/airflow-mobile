import type {
	Carrier,
	CarrierDTO,
	CarrierKind,
	Db,
	Forwarder,
	LabelDTO,
	OrderReadiness,
	PickingOrder,
	PickingOrderDetailDTO,
	PickingOrderSummaryDTO,
	PickLine,
	PickLineDTO,
	Progress,
	SalesOrder,
	Shipment,
	ShipmentDTO
} from '$lib/types';

/**
 * Logika "po stronie backendu" – wyliczenia postępu, wag, etykiet, spedytora i budowanie DTO.
 * Widoki dostają gotowe dane i niczego z tego nie liczą same.
 */

const round = (n: number, digits = 1): number => Math.round(n * 10 ** digits) / 10 ** digits;

export function find<T extends { id: string }>(list: T[], id: string | null | undefined): T {
	let item = list.find((x) => x.id === id);
	if (!item) throw new Error(`Nie znaleziono rekordu ${id}`);
	return item;
}

// --- nośniki -----------------------------------------------------------------

function carrierTypeKey(c: Carrier): string {
	if (c.typeId) return c.typeId;
	let d = c.custom!;
	return `custom:${d.name}:${d.lengthCm}x${d.widthCm}x${d.heightCm}`;
}

export function contentSignature(c: Carrier): string {
	let items = [...c.items].sort((a, b) => a.lineId.localeCompare(b.lineId)).map((i) => `${i.lineId}:${i.qty}`);
	return `${carrierTypeKey(c)}#${items.join(',')}`;
}

export function carrierSpec(db: Db, c: { typeId: string | null; custom: Carrier['custom'] }) {
	if (c.typeId) return find(db.carrierTypes, c.typeId);
	return c.custom!;
}

function lineOf(db: Db, lineId: string): { po: PickingOrder; line: PickLine } {
	for (let po of db.pickingOrders) {
		let line = po.lines.find((l) => l.id === lineId);
		if (line) return { po, line };
	}
	throw new Error(`Nie znaleziono pozycji ${lineId}`);
}

export function carriersOfSalesOrder(db: Db, salesOrderId: string): Carrier[] {
	let poIds = new Set(db.pickingOrders.filter((p) => p.salesOrderId === salesOrderId).map((p) => p.id));
	return db.carriers.filter((c) => poIds.has(c.pickingOrderId)).sort((a, b) => a.no - b.no);
}

/** Rodzaj nośników zamówienia – wyznaczony przez pierwszy dodany nośnik (bez transportów mieszanych) */
export function carrierKindOf(db: Db, salesOrderId: string): CarrierKind | null {
	let first = carriersOfSalesOrder(db, salesOrderId)[0];
	return first ? carrierSpec(db, first).kind : null;
}

/** Spedytor wynika z rodzaju nośników: palety -> spedytor paletowy, paczki -> paczkowy */
export function forwarderOf(db: Db, salesOrderId: string): Forwarder | null {
	let kind = carrierKindOf(db, salesOrderId);
	return kind ? (db.forwarders.find((f) => f.kind === kind) ?? null) : null;
}

export function carrierDTO(db: Db, c: Carrier): CarrierDTO {
	let spec = carrierSpec(db, c);
	let po = find(db.pickingOrders, c.pickingOrderId);
	let items = c.items.map((i) => {
		let { line } = lineOf(db, i.lineId);
		return { lineId: i.lineId, qty: i.qty, product: find(db.products, line.productId), location: line.location };
	});
	let computed = round(spec.tareKg + items.reduce((sum, i) => sum + i.qty * i.product.unitWeightKg, 0));

	return {
		id: c.id,
		code: c.code,
		no: c.no,
		of: carriersOfSalesOrder(db, po.salesOrderId).length,
		kind: spec.kind,
		name: spec.name,
		typeId: c.typeId,
		custom: c.custom,
		dimensions: `${spec.lengthCm}×${spec.widthCm}×${spec.heightCm} cm`,
		proposedByOffice: c.proposedByOffice,
		items,
		totalQty: items.reduce((sum, i) => sum + i.qty, 0),
		weightKg: c.weightOverrideKg ?? computed,
		computedWeightKg: computed,
		weightOverrideKg: c.weightOverrideKg,
		hasLabel: c.label !== null,
		contentLabelOutdated: c.contentLabel !== null && c.contentLabel.signature !== contentSignature(c),
		contentLabelMissing: c.items.length > 0 && c.contentLabel === null,
		stagedAt: c.stagedAt,
		dock: c.dock
	};
}

// --- pozycje i postęp ----------------------------------------------------------

export function packedQty(db: Db, lineId: string): number {
	let total = 0;
	for (let c of db.carriers) for (let i of c.items) if (i.lineId === lineId) total += i.qty;
	return total;
}

function lineDTO(db: Db, po: PickingOrder, line: PickLine): PickLineDTO {
	let packed = packedQty(db, line.id);
	let packedOn = db.carriers
		.filter((c) => c.pickingOrderId === po.id)
		.flatMap((c) => c.items.filter((i) => i.lineId === line.id).map((i) => ({ carrierId: c.id, carrierCode: c.code, qty: i.qty })));

	return {
		id: line.id,
		seq: line.seq,
		product: find(db.products, line.productId),
		location: line.location,
		qty: line.qty,
		packedQty: packed,
		remainingQty: Math.max(0, line.qty - packed),
		deferred: po.deferredLineIds.includes(line.id),
		packedOn
	};
}

function progress(db: Db, po: PickingOrder): Progress {
	return {
		lines: po.lines.length,
		linesDone: po.lines.filter((l) => packedQty(db, l.id) >= l.qty).length
	};
}

export function releaseBlockers(db: Db, po: PickingOrder): string[] {
	let blockers: string[] = [];
	let p = progress(db, po);
	let carriers = db.carriers.filter((c) => c.pickingOrderId === po.id);

	if (p.linesDone < p.lines) blockers.push(`Niespakowane pozycje: ${p.lines - p.linesDone}`);
	if (carriers.length === 0) blockers.push('Brak nośników');

	let empty = carriers.filter((c) => c.items.length === 0);
	if (empty.length) blockers.push(`Puste nośniki: ${empty.map((c) => c.code).join(', ')} – usuń je`);

	let toPrint = carriers.filter((c) => {
		let dto = carrierDTO(db, c);
		return c.items.length > 0 && (!dto.hasLabel || dto.contentLabelMissing || dto.contentLabelOutdated);
	});
	if (toPrint.length) blockers.push(`Etykiety do wydruku: ${toPrint.map((c) => c.code).join(', ')}`);

	return blockers;
}

// --- zlecenia kompletacyjne ----------------------------------------------------

export function summaryDTO(db: Db, po: PickingOrder): PickingOrderSummaryDTO {
	let salesOrder = find(db.salesOrders, po.salesOrderId);
	let carriers = db.carriers
		.filter((c) => c.pickingOrderId === po.id)
		.sort((a, b) => a.no - b.no)
		.map((c) => carrierDTO(db, c));

	return {
		id: po.id,
		number: po.number,
		approvedAt: po.approvedAt,
		released: po.releasedAt !== null,
		salesOrder,
		customer: find(db.customers, salesOrder.customerId),
		forwarder: forwarderOf(db, salesOrder.id),
		progress: progress(db, po),
		carriers,
		carriersWithoutLabel: carriers.filter((c) => !c.hasLabel).length,
		releaseBlockers: releaseBlockers(db, po)
	};
}

export function detailDTO(db: Db, po: PickingOrder): PickingOrderDetailDTO {
	let summary = summaryDTO(db, po);
	let lines = [...po.lines].sort((a, b) => a.seq - b.seq).map((l) => lineDTO(db, po, l));
	let deferredRank = (l: PickLineDTO) => (l.deferred ? 1 + po.deferredLineIds.indexOf(l.id) : 0);
	let queue = lines.filter((l) => l.remainingQty > 0).sort((a, b) => deferredRank(a) - deferredRank(b) || a.seq - b.seq);

	return {
		...summary,
		carrierKind: carrierKindOf(db, po.salesOrderId),
		carrierTypes: db.carrierTypes,
		forwarders: db.forwarders,
		lines,
		queue,
		current: queue[0] ?? null
	};
}

// --- wysyłka ------------------------------------------------------------------

export function readiness(db: Db, so: SalesOrder): OrderReadiness {
	let pos = db.pickingOrders.filter((p) => p.salesOrderId === so.id).sort((a, b) => a.number.localeCompare(b.number));
	let pickingOrders = pos.map((po) => ({
		id: po.id,
		number: po.number,
		released: po.releasedAt !== null,
		progress: progress(db, po),
		carriers: db.carriers
			.filter((c) => c.pickingOrderId === po.id)
			.sort((a, b) => a.no - b.no)
			.map((c) => carrierDTO(db, c))
	}));
	let carriers = pickingOrders.flatMap((p) => p.carriers);
	let waitingFor = pickingOrders.filter((p) => !p.released).map((p) => p.number);
	let staged = carriers.filter((c) => c.stagedAt).length;

	return {
		salesOrder: so,
		customer: find(db.customers, so.customerId),
		// zamówienie w wysyłce ma zawsze nośniki, więc spedytor jest znany
		forwarder: forwarderOf(db, so.id)!,
		pickingOrders,
		carriersTotal: carriers.length,
		carriersStaged: staged,
		weightKg: round(carriers.reduce((sum, c) => sum + c.weightKg, 0)),
		ready: waitingFor.length === 0 && carriers.length > 0 && staged === carriers.length,
		waitingFor
	};
}

export function shipmentDTO(db: Db, s: Shipment): ShipmentDTO {
	let carriers = s.carrierIds.map((id) => carrierDTO(db, find(db.carriers, id)));
	return {
		...s,
		forwarder: find(db.forwarders, s.forwarderId),
		orders: s.salesOrderIds.map((id) => {
			let so = find(db.salesOrders, id);
			return { number: so.number, customer: find(db.customers, so.customerId).name };
		}),
		carriers: carriers.length,
		weightKg: round(carriers.reduce((sum, c) => sum + c.weightKg, 0))
	};
}

// --- kody i etykiety -----------------------------------------------------------

/** Kod nośnika: NS-RRMMDD-NNNNN (15 znaków) */
export function nextCarrierCode(db: Db): string {
	let d = new Date();
	let ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
	return `NS-${ymd}-${String(db.counters.carrierCode++).padStart(5, '0')}`;
}

export function labelDTO(db: Db, c: Carrier, withContent: boolean): LabelDTO {
	let dto = carrierDTO(db, c);
	let po = find(db.pickingOrders, c.pickingOrderId);
	let so = find(db.salesOrders, po.salesOrderId);

	return {
		carrierId: c.id,
		code: c.code,
		no: dto.no,
		of: dto.of,
		carrierName: dto.name,
		dimensions: dto.dimensions,
		weightKg: dto.weightKg,
		customer: find(db.customers, so.customerId),
		forwarder: forwarderOf(db, so.id)!,
		salesOrderNumber: so.number,
		customerOrderNumber: so.customerOrderNumber,
		pickingOrderNumber: po.number,
		shipDate: so.shipDate,
		withContent,
		items: withContent ? dto.items.map((i) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty, unit: i.product.unit })) : [],
		printedAt: c.label!.printedAt,
		printCount: c.label!.printCount
	};
}
