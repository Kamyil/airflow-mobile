import { contentSignature, dispatchGroups, find, forwarderOf, labelDTO, readiness, shipmentDTO } from '$lib/mock/domain';
import type { DispatchGroupDTO, EmailGroup, LabelDTO, ShipmentDTO } from '$lib/types';
import { ApiError, mutate, now, query, requireOnline, who } from './core';

/**
 * Wydania (jak dok-app: "Do wydania" / "Wydane"), zasilane wydanymi kompletacjami.
 * Do wydania: wydruk etykiet wysyłkowych (odstawienie na DOK) -> skan nośników przy załadunku ->
 * finalizacja (zdjęcia, kierowca + podpis, e-mail z podsumowaniem). Wydane: podgląd, dosłanie zdjęć,
 * ponowny e-mail, wycofanie zamówienia z wysyłki.
 */

export function listDispatchGroups(f: { dock?: string | null } = {}): Promise<DispatchGroupDTO[]> {
	return query((db) => dispatchGroups(db).filter((g) => !f.dock || g.dock === f.dock));
}

export function getDispatchGroup(forwarderId: string): Promise<DispatchGroupDTO | null> {
	return query((db) => dispatchGroups(db).find((g) => g.forwarder.id === forwarderId) ?? null);
}

export function listEmailGroups(): Promise<EmailGroup[]> {
	return query((db) => db.emailGroups);
}

/** Wydruk etykiet wysyłkowych (z zawartością) – nośnik zostaje odstawiony na DOK spedytora */
export function printShippingLabels(carrierIds: string[]): Promise<LabelDTO[]> {
	return mutate('Druk etykiet wysyłkowych', (db) =>
		carrierIds.map((id) => {
			let c = find(db.carriers, id);
			let po = find(db.pickingOrders, c.pickingOrderId);
			if (!po.releasedAt) throw new ApiError('VALIDATION', `${po.number} nie zostało wydane z kompletacji`);
			c.label = c.label ? { printedAt: now(), printCount: c.label.printCount + 1 } : { printedAt: now(), printCount: 1 };
			c.contentLabel = { printedAt: now(), signature: contentSignature(c) };
			c.stagedAt ??= now();
			c.dock ??= forwarderOf(db, po.salesOrderId)!.defaultDock;
			return labelDTO(db, c, c.items.length > 0);
		})
	);
}

/** Cofnięcie wydania kompletacji – zlecenie wraca do Kompletacji */
export function revertRelease(pickingOrderId: string): Promise<void> {
	return mutate('Cofnięcie wydania kompletacji', (db) => {
		let po = find(db.pickingOrders, pickingOrderId);
		if (po.shippedAt) throw new ApiError('VALIDATION', 'Zlecenie zostało już wysłane');
		po.releasedAt = null;
		for (let c of db.carriers.filter((c) => c.pickingOrderId === po.id)) {
			c.stagedAt = null;
			c.dock = null;
			c.loadedAt = null;
		}
	});
}

/** Skan nośnika przy załadunku na auto spedytora */
export function loadCarrier(forwarderId: string, code: string): Promise<{ carrierCode: string; orderNumber: string; orderComplete: boolean; allLoaded: boolean }> {
	return mutate('Załadunek nośnika', (db) => {
		let c = code.trim().toUpperCase();
		let carrier = db.carriers.find((x) => x.code === c) ?? (/^\d{5}$/.test(c) ? db.carriers.find((x) => x.code.endsWith(c)) : undefined);
		if (!carrier) throw new ApiError('VALIDATION', `Nieznany kod nośnika ${c}`);
		let po = find(db.pickingOrders, carrier.pickingOrderId);
		let so = find(db.salesOrders, po.salesOrderId);
		let fw = forwarderOf(db, so.id);
		if (fw?.id !== forwarderId) throw new ApiError('VALIDATION', `Nośnik ${carrier.code} jedzie z ${fw?.name ?? 'innym spedytorem'}`);
		if (po.shippedAt) throw new ApiError('VALIDATION', `Nośnik ${carrier.code} został już wydany`);
		let r = readiness(db, so);
		if (!r.ready) throw new ApiError('VALIDATION', `Zamówienie ${so.number} nie jest gotowe`, r.waitingFor.length ? [`Czeka na kompletację: ${r.waitingFor.join(', ')}`] : ['Wydrukuj etykiety wysyłkowe wszystkich nośników']);
		if (carrier.loadedAt) throw new ApiError('VALIDATION', `Nośnik ${carrier.code} jest już załadowany`);

		carrier.loadedAt = now();
		let after = readiness(db, so);
		let group = dispatchGroups(db).find((g) => g.forwarder.id === forwarderId)!;
		return { carrierCode: carrier.code, orderNumber: so.number, orderComplete: after.carriersLoaded === after.carriersTotal, allLoaded: group.carriersLoaded === group.carriersReady };
	});
}

export function unloadCarrier(carrierId: string): Promise<void> {
	return mutate('Cofnięcie załadunku nośnika', (db) => {
		find(db.carriers, carrierId).loadedAt = null;
	});
}

export function unloadOrder(salesOrderId: string): Promise<void> {
	return mutate('Cofnięcie załadunku zamówienia', (db) => {
		let poIds = new Set(db.pickingOrders.filter((p) => p.salesOrderId === salesOrderId).map((p) => p.id));
		for (let c of db.carriers.filter((c) => poIds.has(c.pickingOrderId))) c.loadedAt = null;
	});
}

export interface FinalizeInput {
	driverName: string;
	plate: string;
	signature: string | null;
	photos: string[];
	emailGroupIds: string[];
}

/** Finalizacja wydania: jadą tylko zamówienia w całości załadowane */
export function finalizeDispatch(forwarderId: string, input: FinalizeInput): Promise<{ shipmentId: string; number: string }> {
	return mutate('Finalizacja wydania', (db) => {
		let group = dispatchGroups(db).find((g) => g.forwarder.id === forwarderId);
		if (!group) throw new ApiError('NOT_FOUND', 'Brak zamówień do wydania');
		let errors: string[] = [];
		if (group.partialOrders.length) errors.push(`Częściowo załadowane: ${group.partialOrders.join(', ')} – dokończ albo cofnij załadunek`);
		if (!group.loadedOrders) errors.push('Nie załadowano żadnego zamówienia');
		if (!input.driverName.trim()) errors.push('Podaj imię i nazwisko kierowcy');
		if (!input.plate.trim()) errors.push('Podaj numer rejestracyjny');
		if (!input.signature) errors.push('Brak podpisu kierowcy');
		if (errors.length) throw new ApiError('VALIDATION', 'Nie można zakończyć wydania', errors);

		let orders = group.orders.filter((o) => o.ready && o.carriersLoaded === o.carriersTotal);
		let seq = db.counters.shipment++;
		let closedAt = now();
		let shipment = {
			id: `sh-${seq}`,
			number: `WYS/${closedAt.slice(0, 4)}/${String(seq).padStart(4, '0')}`,
			forwarderId,
			salesOrderIds: orders.map((o) => o.salesOrder.id),
			carrierIds: orders.flatMap((o) => o.pickingOrders.flatMap((p) => p.carriers.map((c) => c.id))),
			waybillNo: `${forwarderId.slice(0, 3).toUpperCase()}-${Math.floor(7_000_000_000 + Math.random() * 999_999_999)}`,
			closedAt,
			dock: group.dock,
			driver: { name: input.driverName.trim(), plate: input.plate.trim().toUpperCase(), signature: input.signature },
			photos: input.photos.map((src) => ({ id: `ph-${db.counters.photo++}`, src, takenAt: closedAt })),
			emails: input.emailGroupIds.length ? [{ groupIds: [...input.emailGroupIds], sentAt: closedAt }] : [],
			withdrawn: [],
			operator: who()
		};
		db.shipments.push(shipment);
		for (let po of db.pickingOrders.filter((p) => shipment.salesOrderIds.includes(p.salesOrderId) && p.releasedAt)) {
			po.shippedAt = closedAt;
			po.shipmentId = shipment.id;
		}
		return { shipmentId: shipment.id, number: shipment.number };
	});
}

export function listShipments(f: { date?: string | null } = {}): Promise<ShipmentDTO[]> {
	return query((db) =>
		db.shipments
			.filter((s) => !f.date || s.closedAt.startsWith(f.date))
			.map((s) => shipmentDTO(db, s))
			.sort((a, b) => b.closedAt.localeCompare(a.closedAt))
	);
}

export function getShipment(id: string): Promise<ShipmentDTO> {
	return query((db) => {
		let s = db.shipments.find((x) => x.id === id);
		if (!s) throw new ApiError('NOT_FOUND', 'Nie znaleziono wydania');
		return shipmentDTO(db, s);
	});
}

export function addShipmentPhotos(id: string, photos: string[]): Promise<void> {
	return mutate('Dodanie zdjęć do wydania', (db) => {
		let s = find(db.shipments, id);
		for (let src of photos) s.photos.push({ id: `ph-${db.counters.photo++}`, src, takenAt: now() });
	});
}

export function sendShipmentEmail(id: string, groupIds: string[]): Promise<void> {
	requireOnline('wysyłka e-maila');
	return mutate('Wysyłka podsumowania e-mail', (db) => {
		if (!groupIds.length) throw new ApiError('VALIDATION', 'Wybierz co najmniej jedną grupę odbiorców');
		find(db.shipments, id).emails.push({ groupIds: [...groupIds], sentAt: now() });
	});
}

/** Wycofanie zamówień z zamkniętej wysyłki – wracają do "Do wydania" (nie pojechały) */
export function withdrawOrders(id: string, salesOrderIds: string[]): Promise<void> {
	return mutate('Wycofanie zamówień z wydania', (db) => {
		let s = find(db.shipments, id);
		if (!salesOrderIds.length) throw new ApiError('VALIDATION', 'Zaznacz zamówienia do wycofania');
		for (let soId of salesOrderIds) {
			if (s.withdrawn.some((w) => w.salesOrderId === soId)) continue;
			s.withdrawn.push({ salesOrderId: soId, at: now(), by: who() });
			for (let po of db.pickingOrders.filter((p) => p.salesOrderId === soId && p.shipmentId === s.id)) {
				po.shippedAt = null;
				po.shipmentId = null;
				for (let c of db.carriers.filter((c) => c.pickingOrderId === po.id)) c.loadedAt = null;
			}
		}
	});
}
