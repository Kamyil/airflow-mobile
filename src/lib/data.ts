import type { Db } from './types';

/**
 * Dane mockowe – stan początkowy "backendu".
 * Widoki NIE importują tego pliku bezpośrednio – korzystają wyłącznie z `$lib/api`.
 *
 * Sygnatura etykiety zawartości = `<typ>#<lineId>:<ilość>,...` (pozycje posortowane po lineId),
 * dla nośnika własnego typ to `custom:<nazwa>:<dł>x<szer>x<wys>`.
 */
export const seed: Db = {
	operator: {
		name: 'Jan Kowalski',
		device: 'TC52 #07',
		printer: 'Zebra ZD421 · Strefa pakowania'
	},

	// Spedytor wynika z rodzaju nośnika: palety -> Raben, paczki -> DPD
	forwarders: [
		{ id: 'raben', name: 'Raben', kind: 'PALLET', defaultDock: 'Rampa 1' },
		{ id: 'dpd', name: 'DPD', kind: 'PARCEL', defaultDock: 'Strefa paczek' }
	],

	carrierTypes: [
		{ id: 'eur', kind: 'PALLET', name: 'Paleta EUR', lengthCm: 120, widthCm: 80, heightCm: 180, tareKg: 25 },
		{ id: 'half', kind: 'PALLET', name: 'Półpaleta', lengthCm: 80, widthCm: 60, heightCm: 120, tareKg: 12 },
		{ id: 'box', kind: 'PARCEL', name: 'Paczka (karton)', lengthCm: 60, widthCm: 40, heightCm: 40, tareKg: 0.8 }
	],

	customers: [
		{ id: 'c1', name: 'Budmat Hurtownia Sp. z o.o.', street: 'ul. Przemysłowa 14', postalCode: '61-248', city: 'Poznań', country: 'PL' },
		{ id: 'c2', name: 'Termo-Instal S.A.', street: 'ul. Kolejowa 8', postalCode: '40-602', city: 'Katowice', country: 'PL' },
		{ id: 'c3', name: 'Domex Market Sp. j.', street: 'ul. Lipowa 3', postalCode: '80-126', city: 'Gdańsk', country: 'PL' },
		{ id: 'c4', name: 'Arkom Budownictwo', street: 'ul. Polna 22', postalCode: '30-418', city: 'Kraków', country: 'PL' },
		{ id: 'c5', name: 'Instalbud s.c.', street: 'ul. Hubska 51', postalCode: '50-502', city: 'Wrocław', country: 'PL' }
	],

	products: [
		{ id: 'p01', sku: 'KLM-310', ean: '5901234100017', name: 'Klej montażowy MS 310 ml', unit: 'szt', unitWeightKg: 0.45 },
		{ id: 'p02', sku: 'PNM-750', ean: '5901234100024', name: 'Pianka montażowa 750 ml', unit: 'szt', unitWeightKg: 0.9 },
		{ id: 'p03', sku: 'SIL-280', ean: '5901234100031', name: 'Silikon sanitarny biały 280 ml', unit: 'szt', unitWeightKg: 0.35 },
		{ id: 'p04', sku: 'TAS-AL50', ean: '5901234100048', name: 'Taśma aluminiowa 50 mm × 50 m', unit: 'rol', unitWeightKg: 0.6 },
		{ id: 'p05', sku: 'RUR-PP20', ean: '5901234100055', name: 'Rura PP-R 20 mm, odc. 4 m', unit: 'szt', unitWeightKg: 0.7 },
		{ id: 'p06', sku: 'KOL-PP20', ean: '5901234100062', name: 'Kolano PP-R 20 mm 90° (op. 50 szt)', unit: 'opak', unitWeightKg: 0.8 },
		{ id: 'p07', sku: 'ZAW-KUL12', ean: '5901234100079', name: 'Zawór kulowy 1/2"', unit: 'szt', unitWeightKg: 0.25 },
		{ id: 'p08', sku: 'WKR-6x60', ean: '5901234100086', name: 'Wkręty do drewna 6×60 (op. 200)', unit: 'opak', unitWeightKg: 1.2 },
		{ id: 'p09', sku: 'KOL-8x50', ean: '5901234100093', name: 'Kołki rozporowe 8×50 (op. 100)', unit: 'opak', unitWeightKg: 0.5 },
		{ id: 'p10', sku: 'ZPR-25', ean: '5901234100109', name: 'Zaprawa klejowa C2TE 25 kg', unit: 'szt', unitWeightKg: 25 },
		{ id: 'p11', sku: 'GRU-5L', ean: '5901234100116', name: 'Grunt głęboko penetrujący 5 l', unit: 'szt', unitWeightKg: 5.3 },
		{ id: 'p12', sku: 'FAR-10L', ean: '5901234100123', name: 'Farba lateksowa biała 10 l', unit: 'szt', unitWeightKg: 14 },
		{ id: 'p13', sku: 'WEL-100', ean: '5901234100130', name: 'Wełna mineralna 100 mm (paczka)', unit: 'opak', unitWeightKg: 9 },
		{ id: 'p14', sku: 'PRF-CD60', ean: '5901234100147', name: 'Profil CD60, 3 m', unit: 'szt', unitWeightKg: 1.5 },
		{ id: 'p15', sku: 'PLY-GKB', ean: '5901234100154', name: 'Płyta g-k 12,5 mm 120×260', unit: 'szt', unitWeightKg: 24 },
		{ id: 'p16', sku: 'SIA-145', ean: '5901234100161', name: 'Siatka z włókna szklanego 1×50 m', unit: 'rol', unitWeightKg: 7.5 },
		{ id: 'p17', sku: 'RKW-NIT', ean: '5901234100178', name: 'Rękawice robocze nitrylowe (op. 12 par)', unit: 'opak', unitWeightKg: 0.9 },
		{ id: 'p18', sku: 'FOL-PE02', ean: '5901234100185', name: 'Folia PE 0,2 mm 4×25 m', unit: 'rol', unitWeightKg: 18 },
		{ id: 'p19', sku: 'LIS-PRZ', ean: '5901234100192', name: 'Listwa przypodłogowa 2,5 m', unit: 'szt', unitWeightKg: 0.6 },
		{ id: 'p20', sku: 'ZST-WC', ean: '5901234100208', name: 'Zestaw instalacyjny WC', unit: 'kpl', unitWeightKg: 6.8 }
	],

	salesOrders: [
		{ id: 'so-0412', number: 'ZAM/2026/09/0412', customerOrderNumber: 'BM-5521', customerId: 'c1', shipDate: '2026-09-29' },
		{ id: 'so-0415', number: 'ZAM/2026/09/0415', customerOrderNumber: 'TI/0934/26', customerId: 'c2', shipDate: '2026-09-29' },
		{ id: 'so-0409', number: 'ZAM/2026/09/0409', customerOrderNumber: 'DX-77120', customerId: 'c3', shipDate: '2026-09-28' },
		{ id: 'so-0403', number: 'ZAM/2026/09/0403', customerOrderNumber: 'ARK-311', customerId: 'c4', shipDate: '2026-09-28' },
		{ id: 'so-0398', number: 'ZAM/2026/09/0398', customerOrderNumber: 'IB-2026-118', customerId: 'c5', shipDate: '2026-09-28' },
		{ id: 'so-0395', number: 'ZAM/2026/09/0395', customerOrderNumber: 'TI/0911/26', customerId: 'c2', shipDate: '2026-09-28' },
		{ id: 'so-0390', number: 'ZAM/2026/09/0390', customerOrderNumber: 'DX-77004', customerId: 'c3', shipDate: '2026-09-27' }
	],

	pickingOrders: [
		// --- Nowe, biuro zaproponowało nośniki (bez etykiet) ---
		{
			id: 'pk-0871',
			number: 'ZK/2026/0871',
			salesOrderId: 'so-0412',
			approvedAt: '2026-09-28T06:12:00',
			lines: [
				{ id: 'l-0871-1', seq: 1, productId: 'p10', location: 'A-01-01-A', qty: 12 },
				{ id: 'l-0871-2', seq: 2, productId: 'p11', location: 'A-01-03-B', qty: 8 },
				{ id: 'l-0871-3', seq: 3, productId: 'p12', location: 'A-02-01-A', qty: 6 },
				{ id: 'l-0871-4', seq: 4, productId: 'p13', location: 'A-02-04-C', qty: 10 },
				{ id: 'l-0871-5', seq: 5, productId: 'p02', location: 'A-03-02-B', qty: 24 },
				{ id: 'l-0871-6', seq: 6, productId: 'p01', location: 'A-03-02-C', qty: 36 },
				{ id: 'l-0871-7', seq: 7, productId: 'p03', location: 'A-03-05-A', qty: 24 }
			],
			deferredLineIds: [],
			startedAt: null,
			confirmedAt: null,
			releasedAt: null,
			shippedAt: null,
			shipmentId: null
		},
		// --- To samo zamówienie, inna strefa, bez sugestii nośników ---
		{
			id: 'pk-0872',
			number: 'ZK/2026/0872',
			salesOrderId: 'so-0412',
			approvedAt: '2026-09-28T06:12:00',
			lines: [
				{ id: 'l-0872-1', seq: 1, productId: 'p14', location: 'C-01-01-A', qty: 40 },
				{ id: 'l-0872-2', seq: 2, productId: 'p19', location: 'C-01-02-A', qty: 30 },
				{ id: 'l-0872-3', seq: 3, productId: 'p16', location: 'C-04-01-B', qty: 4 },
				{ id: 'l-0872-4', seq: 4, productId: 'p18', location: 'C-04-03-A', qty: 2 }
			],
			deferredLineIds: [],
			startedAt: null,
			confirmedAt: null,
			releasedAt: null,
			shippedAt: null,
			shipmentId: null
		},
		// --- Nowe, paczki, bez sugestii; jeden produkt z dwóch lokalizacji ---
		{
			id: 'pk-0874',
			number: 'ZK/2026/0874',
			salesOrderId: 'so-0415',
			approvedAt: '2026-09-28T07:40:00',
			lines: [
				{ id: 'l-0874-1', seq: 1, productId: 'p07', location: 'B-02-01-A', qty: 12 },
				{ id: 'l-0874-2', seq: 2, productId: 'p07', location: 'B-02-01-B', qty: 8 },
				{ id: 'l-0874-3', seq: 3, productId: 'p06', location: 'B-02-03-B', qty: 6 },
				{ id: 'l-0874-4', seq: 4, productId: 'p04', location: 'B-03-02-A', qty: 10 },
				{ id: 'l-0874-5', seq: 5, productId: 'p20', location: 'B-06-01-A', qty: 2 }
			],
			deferredLineIds: [],
			startedAt: null,
			confirmedAt: null,
			releasedAt: null,
			shippedAt: null,
			shipmentId: null
		},
		// --- W trakcie ---
		{
			id: 'pk-0866',
			number: 'ZK/2026/0866',
			salesOrderId: 'so-0409',
			approvedAt: '2026-09-28T05:55:00',
			lines: [
				{ id: 'l-0866-1', seq: 1, productId: 'p15', location: 'A-05-01-A', qty: 10 },
				{ id: 'l-0866-2', seq: 2, productId: 'p10', location: 'A-01-01-A', qty: 6 },
				{ id: 'l-0866-3', seq: 3, productId: 'p08', location: 'A-04-02-B', qty: 12 },
				{ id: 'l-0866-4', seq: 4, productId: 'p09', location: 'A-04-02-C', qty: 10 },
				{ id: 'l-0866-5', seq: 5, productId: 'p17', location: 'A-06-01-A', qty: 4 }
			],
			deferredLineIds: [],
			startedAt: '2026-09-28T08:05:00',
			confirmedAt: null,
			releasedAt: null,
			shippedAt: null,
			shipmentId: null
		},
		// --- Skompletowane, ale jedna etykieta zawartości nieaktualna ---
		{
			id: 'pk-0861',
			number: 'ZK/2026/0861',
			salesOrderId: 'so-0403',
			approvedAt: '2026-09-27T14:30:00',
			lines: [
				{ id: 'l-0861-1', seq: 1, productId: 'p20', location: 'B-06-01-A', qty: 8 },
				{ id: 'l-0861-2', seq: 2, productId: 'p05', location: 'B-05-01-A', qty: 30 },
				{ id: 'l-0861-3', seq: 3, productId: 'p07', location: 'B-02-01-A', qty: 16 },
				{ id: 'l-0861-4', seq: 4, productId: 'p06', location: 'B-02-03-B', qty: 12 }
			],
			deferredLineIds: [],
			startedAt: '2026-09-28T06:40:00',
			confirmedAt: '2026-09-28T07:32:00',
			releasedAt: null,
			shippedAt: null,
			shipmentId: null
		},
		// --- Wydane, częściowo odstawione ---
		{
			id: 'pk-0858',
			number: 'ZK/2026/0858',
			salesOrderId: 'so-0398',
			approvedAt: '2026-09-27T12:10:00',
			lines: [
				{ id: 'l-0858-1', seq: 1, productId: 'p07', location: 'B-02-01-A', qty: 10 },
				{ id: 'l-0858-2', seq: 2, productId: 'p06', location: 'B-02-03-B', qty: 4 },
				{ id: 'l-0858-3', seq: 3, productId: 'p04', location: 'B-03-02-A', qty: 12 },
				{ id: 'l-0858-4', seq: 4, productId: 'p20', location: 'B-06-01-A', qty: 1 }
			],
			deferredLineIds: [],
			startedAt: '2026-09-27T13:02:00',
			confirmedAt: '2026-09-27T13:40:00',
			releasedAt: '2026-09-28T07:15:00',
			shippedAt: null,
			shipmentId: null
		},
		// --- Wydane i w całości odstawione na rampę -> gotowe do zamknięcia ---
		{
			id: 'pk-0855',
			number: 'ZK/2026/0855',
			salesOrderId: 'so-0395',
			approvedAt: '2026-09-27T11:00:00',
			lines: [
				{ id: 'l-0855-1', seq: 1, productId: 'p14', location: 'C-01-01-A', qty: 60 },
				{ id: 'l-0855-2', seq: 2, productId: 'p19', location: 'C-01-02-A', qty: 40 },
				{ id: 'l-0855-3', seq: 3, productId: 'p16', location: 'C-04-01-B', qty: 4 },
				{ id: 'l-0855-4', seq: 4, productId: 'p18', location: 'C-04-03-A', qty: 2 }
			],
			deferredLineIds: [],
			startedAt: '2026-09-27T12:20:00',
			confirmedAt: '2026-09-27T13:05:00',
			releasedAt: '2026-09-27T13:10:00',
			shippedAt: null,
			shipmentId: null
		},
		// --- Wysłane wczoraj ---
		{
			id: 'pk-0849',
			number: 'ZK/2026/0849',
			salesOrderId: 'so-0390',
			approvedAt: '2026-09-26T15:20:00',
			lines: [{ id: 'l-0849-1', seq: 1, productId: 'p10', location: 'A-01-01-A', qty: 20 }],
			deferredLineIds: [],
			startedAt: '2026-09-27T07:00:00',
			confirmedAt: '2026-09-27T07:25:00',
			releasedAt: '2026-09-27T07:30:00',
			shippedAt: '2026-09-27T10:45:00',
			shipmentId: 'sh-0212'
		}
	],

	carriers: [
		// ZK/0871 – propozycja biura, bez etykiet
		{ id: 'k-01', code: 'NS-260928-00121', pickingOrderId: 'pk-0871', no: 1, typeId: 'eur', custom: null, proposedByOffice: true, items: [], weightOverrideKg: null, label: null, contentLabel: null, stagedAt: null, dock: null },
		{ id: 'k-02', code: 'NS-260928-00122', pickingOrderId: 'pk-0871', no: 2, typeId: 'eur', custom: null, proposedByOffice: true, items: [], weightOverrideKg: null, label: null, contentLabel: null, stagedAt: null, dock: null },

		// ZK/0866 – w trakcie
		{
			id: 'k-03', code: 'NS-260928-00117', pickingOrderId: 'pk-0866', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0866-1', qty: 10 }, { lineId: 'l-0866-2', qty: 6 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-28T08:02:00', printCount: 1 }, contentLabel: null, stagedAt: null, dock: null
		},
		{
			id: 'k-04', code: 'NS-260928-00118', pickingOrderId: 'pk-0866', no: 2, typeId: 'half', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0866-3', qty: 5 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-28T08:02:00', printCount: 1 }, contentLabel: null, stagedAt: null, dock: null
		},

		// ZK/0861 – skompletowane, k-06 ma nieaktualną etykietę zawartości
		{
			id: 'k-05', code: 'NS-260928-00114', pickingOrderId: 'pk-0861', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0861-1', qty: 8 }, { lineId: 'l-0861-3', qty: 16 }, { lineId: 'l-0861-4', qty: 12 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-28T06:38:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-28T07:30:00', signature: 'eur#l-0861-1:8,l-0861-3:16,l-0861-4:12' }, stagedAt: null, dock: null
		},
		{
			id: 'k-06', code: 'NS-260928-00115', pickingOrderId: 'pk-0861', no: 2, typeId: null,
			custom: { name: 'Paleta dłużycowa', kind: 'PALLET', lengthCm: 400, widthCm: 80, heightCm: 60, tareKg: 35 }, proposedByOffice: false,
			items: [{ lineId: 'l-0861-2', qty: 30 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-28T06:38:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-28T07:10:00', signature: 'custom:Paleta dłużycowa:400x80x60#l-0861-2:20' }, stagedAt: null, dock: null
		},

		// ZK/0858 – wydane, jeden karton odstawiony
		{
			id: 'k-07', code: 'NS-260927-00108', pickingOrderId: 'pk-0858', no: 1, typeId: 'box', custom: null, proposedByOffice: false,
			items: [{ lineId: 'l-0858-1', qty: 10 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-27T13:00:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-27T13:38:00', signature: 'box#l-0858-1:10' }, stagedAt: '2026-09-28T07:40:00', dock: 'Strefa paczek'
		},
		{
			id: 'k-08', code: 'NS-260927-00109', pickingOrderId: 'pk-0858', no: 2, typeId: 'box', custom: null, proposedByOffice: false,
			items: [{ lineId: 'l-0858-2', qty: 4 }, { lineId: 'l-0858-3', qty: 12 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-27T13:00:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-27T13:38:00', signature: 'box#l-0858-2:4,l-0858-3:12' }, stagedAt: null, dock: null
		},
		{
			id: 'k-09', code: 'NS-260927-00110', pickingOrderId: 'pk-0858', no: 3, typeId: 'box', custom: null, proposedByOffice: false,
			items: [{ lineId: 'l-0858-4', qty: 1 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-27T13:20:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-27T13:38:00', signature: 'box#l-0858-4:1' }, stagedAt: null, dock: null
		},

		// ZK/0855 – wydane, wszystko na rampie
		{
			id: 'k-10', code: 'NS-260927-00104', pickingOrderId: 'pk-0855', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0855-1', qty: 60 }, { lineId: 'l-0855-2', qty: 40 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-27T12:15:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-27T13:00:00', signature: 'eur#l-0855-1:60,l-0855-2:40' }, stagedAt: '2026-09-27T13:30:00', dock: 'Rampa 2'
		},
		{
			id: 'k-11', code: 'NS-260927-00105', pickingOrderId: 'pk-0855', no: 2, typeId: 'half', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0855-3', qty: 4 }, { lineId: 'l-0855-4', qty: 2 }],
			weightOverrideKg: 72, label: { printedAt: '2026-09-27T12:15:00', printCount: 2 },
			contentLabel: { printedAt: '2026-09-27T13:00:00', signature: 'half#l-0855-3:4,l-0855-4:2' }, stagedAt: '2026-09-27T13:32:00', dock: 'Rampa 2'
		},

		// ZK/0849 – wysłane
		{
			id: 'k-12', code: 'NS-260927-00098', pickingOrderId: 'pk-0849', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
			items: [{ lineId: 'l-0849-1', qty: 20 }],
			weightOverrideKg: null, label: { printedAt: '2026-09-27T06:58:00', printCount: 1 },
			contentLabel: { printedAt: '2026-09-27T07:24:00', signature: 'eur#l-0849-1:20' }, stagedAt: '2026-09-27T07:50:00', dock: 'Rampa 1'
		}
	],

	shipments: [
		{
			id: 'sh-0212',
			number: 'WYS/2026/0212',
			forwarderId: 'raben',
			salesOrderIds: ['so-0390'],
			carrierIds: ['k-12'],
			waybillNo: 'RAB-7730019244',
			closedAt: '2026-09-27T10:45:00'
		}
	],

	counters: { carrier: 13, carrierCode: 123, shipment: 213 }
};
