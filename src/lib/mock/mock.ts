import type { Db, Location, StockItem } from '$lib/types';

/**
 * DANE MOCKOWE – stan początkowy "backendu" (ERP / Impuls / MWS).
 *
 * To jedyne miejsce, w którym żyją dane makiety. Widoki NIE importują tego pliku –
 * korzystają wyłącznie z `$lib/api`, a logika (wyliczenia, statusy, walidacje) jest w `$lib/mock/*`.
 *
 * Daty są liczone względem dnia uruchomienia ("dziś", "wczoraj", "jutro"), żeby makieta
 * zawsze miała świeże awizacje. Po zmianie dnia dane resetują się same (patrz `db.ts`).
 *
 * Sygnatura etykiety zawartości = `<typ>#<lineId>:<ilość>,...` (pozycje posortowane po lineId),
 * dla nośnika własnego typ to `custom:<nazwa>:<dł>x<szer>x<wys>`.
 */

// --- pomocnicze: daty względne ------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

export function day(offset = 0): string {
	let d = new Date();
	d.setDate(d.getDate() + offset);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lokalny znacznik czasu `YYYY-MM-DDTHH:MM:00` dla dnia `offset` względem dziś */
export function at(offset: number, hm: string): string {
	return `${day(offset)}T${hm}:00`;
}

const YM = () => day(0).slice(0, 7).replace('-', '/');
const Y = () => day(0).slice(0, 4);

/** Kod nośnika: NS-RRMMDD-NNNNN (15 znaków) */
function carrierCode(offset: number, n: number): string {
	return `NS-${day(offset).slice(2).replaceAll('-', '')}-${String(n).padStart(5, '0')}`;
}

// --- lokalizacje ---------------------------------------------------------------

/**
 * MG-01: strefy A (chemia budowlana), B (instalacje), C (sucha zabudowa, dłużyce), D (urządzenia)
 * regały 01–06, półki 01–05, miejsca A–C. Kod: STREFA-REGAŁ-PÓŁKA-MIEJSCE, np. A-01-03-B.
 * MG-02 (Franowo): mniejszy, strefa P.
 */
function buildLocations(): Location[] {
	let list: Location[] = [];
	let seq = 0;
	for (let zone of ['A', 'B', 'C', 'D'])
		for (let rack = 1; rack <= 6; rack++)
			for (let shelf = 1; shelf <= 5; shelf++)
				for (let place of ['A', 'B', 'C'])
					list.push({ code: `${zone}-${pad(rack)}-${pad(shelf)}-${place}`, warehouseId: 'mg01', kind: 'STORAGE', zone, seq: ++seq });
	for (let rack = 1; rack <= 4; rack++)
		for (let shelf = 1; shelf <= 3; shelf++)
			for (let place of ['A', 'B'])
				list.push({ code: `P-${pad(rack)}-${pad(shelf)}-${place}`, warehouseId: 'mg02', kind: 'STORAGE', zone: 'P', seq: ++seq });

	// miejsca odstawcze przy DOKach
	list.push(
		{ code: 'ODST-D1', warehouseId: 'mg01', kind: 'STAGING', zone: 'ODST', seq: 0 },
		{ code: 'ODST-D2', warehouseId: 'mg01', kind: 'STAGING', zone: 'ODST', seq: 0 },
		{ code: 'ODST-F1', warehouseId: 'mg02', kind: 'STAGING', zone: 'ODST', seq: 0 }
	);
	return list;
}

// --- stany magazynowe -----------------------------------------------------------

type S = [location: string, productId: string, qty: number, batch?: string, expiry?: string, serials?: string[]];

function buildStock(): StockItem[] {
	let rows: S[] = [
		// strefa A – chemia (partie z datą ważności)
		['A-01-01-A', 'p10', 46, 'ZP2608-114', day(240)],
		['A-01-01-B', 'p10', 30, 'ZP2609-021', day(270)],
		['A-01-03-B', 'p11', 22, 'GR2607-88', day(330)],
		['A-02-01-A', 'p12', 18, 'FL2605-31', day(400)],
		['A-02-04-C', 'p13', 40],
		['A-03-02-B', 'p02', 120, 'PN2608-07', day(300)],
		['A-03-02-B', 'p02', 34, 'PN2610-19', day(330)],
		['A-03-02-C', 'p01', 150, 'KL2609-12', day(380)],
		['A-03-02-C', 'p01', 120, 'KL2610-05', day(400)],
		['A-03-05-A', 'p03', 96, 'SL2607-44', day(200)],
		['A-04-02-B', 'p08', 60],
		['A-04-02-C', 'p09', 75],
		['A-05-01-A', 'p15', 64],
		['A-06-01-A', 'p17', 36],
		['A-01-02-A', 'p25', 32, 'KS2609-03', day(250)],
		['A-01-02-B', 'p26', 28, 'FG2608-77', day(500)],
		['A-01-04-A', 'p29', 16, 'HD2606-15', day(150)],
		// strefa B – instalacje
		['B-02-01-A', 'p07', 64],
		['B-02-01-B', 'p07', 20],
		['B-02-02-A', 'p27', 24],
		['B-02-02-B', 'p27', 6],
		['B-02-03-B', 'p06', 40],
		['B-03-02-A', 'p04', 55],
		['B-05-01-A', 'p05', 180],
		['B-06-01-A', 'p20', 14],
		['B-06-02-A', 'p24', 12],
		// strefa C – sucha zabudowa / dłużyce
		['C-01-01-A', 'p14', 220],
		['C-01-02-A', 'p19', 160],
		['C-04-01-B', 'p16', 18],
		['C-04-03-A', 'p18', 9],
		['C-05-01-A', 'p30', 40, 'GR60-K2-0912'],
		// wysokie składowanie – zapas do uzupełnień strefy kompletacji
		['C-06-05-A', 'p10', 100, 'ZP2609-021', day(270)],
		['C-06-05-B', 'p01', 300, 'KL2609-12', day(380)],
		['C-06-04-A', 'p14', 400],
		// strefa D – urządzenia na numer seryjny
		['D-01-01-A', 'p21', 3, undefined, undefined, ['HP8-24A0193', 'HP8-24A0194', 'HP8-24A0201']],
		['D-01-02-A', 'p22', 4, undefined, undefined, ['KG24-77812', 'KG24-77815', 'KG24-77816', 'KG24-77820']],
		['D-02-01-A', 'p23', 6, undefined, undefined, ['WK18-550021', 'WK18-550022', 'WK18-550023', 'WK18-550031', 'WK18-550032', 'WK18-550040']],
		['D-03-01-A', 'p28', 10, undefined, undefined, Array.from({ length: 10 }, (_, i) => `PV450-${2611000 + i * 7}`)],
		// MG-02 Franowo
		['P-01-01-A', 'p15', 40],
		['P-01-02-A', 'p13', 25],
		['P-02-01-A', 'p12', 10, 'FL2605-31', day(400)],
		['P-02-02-B', 'p05', 90],
		// miejsca odstawcze – towar przyjęty, czeka na alokację (ZM/0041, ZM/0042)
		['ODST-D1', 'p03', 48, 'SL2610-02', day(360)],
		['ODST-D1', 'p02', 36, 'PN2610-19', day(330)],
		['ODST-D2', 'p07', 40],
		['ODST-D2', 'p06', 20],
		['ODST-D2', 'p27', 12]
	];
	return rows.map(([location, productId, qty, batch, expiry, serials], i) => ({
		id: `st-${String(i + 1).padStart(3, '0')}`,
		warehouseId: location.startsWith('P-') || location === 'ODST-F1' ? 'mg02' : 'mg01',
		location,
		productId,
		qty,
		batch: batch ?? null,
		expiry: expiry ?? null,
		serials: serials ?? []
	}));
}

export function createSeed(): Db {
	return {
		seededOn: day(0),

		operator: {
			name: 'Jan Kowalski',
			device: 'TC52 #07',
			printer: 'Zebra ZD421 · Strefa pakowania'
		},

		// PIN do szybkiego logowania i do zatwierdzeń przełożonego (rozbieżności)
		operators: [
			{ id: 'op1', name: 'Jan Kowalski', pin: '1111', role: 'MAGAZYNIER' },
			{ id: 'op2', name: 'Anna Nowak', pin: '2222', role: 'MAGAZYNIER' },
			{ id: 'op3', name: 'Marek Zieliński', pin: '3333', role: 'MAGAZYNIER' },
			{ id: 'op9', name: 'Piotr Wiśniewski', pin: '9999', role: 'KIEROWNIK' }
		],

		warehouses: [
			{ id: 'mg01', code: 'MG-01', name: 'Magazyn Centralny', city: 'Tarnowo Podgórne' },
			{ id: 'mg02', code: 'MG-02', name: 'Magazyn Franowo', city: 'Poznań' }
		],

		docks: [
			{ id: 'd1', warehouseId: 'mg01', name: 'DOK 1', purpose: 'IN', stagingLocation: 'ODST-D1' },
			{ id: 'd2', warehouseId: 'mg01', name: 'DOK 2', purpose: 'IN', stagingLocation: 'ODST-D2' },
			{ id: 'd3', warehouseId: 'mg01', name: 'DOK 3', purpose: 'OUT', stagingLocation: 'ODST-D2' },
			{ id: 'd4', warehouseId: 'mg01', name: 'DOK 4', purpose: 'OUT', stagingLocation: 'ODST-D2' },
			{ id: 'f1', warehouseId: 'mg02', name: 'DOK F1', purpose: 'BOTH', stagingLocation: 'ODST-F1' }
		],

		locations: buildLocations(),
		stock: buildStock(),

		emailGroups: [
			{ id: 'eg1', name: 'Spedycja – Raben Poznań', emails: ['awizacje.poznan@raben.example', 'dyspozytor@raben.example'] },
			{ id: 'eg2', name: 'Spedycja – DPD', emails: ['odbiory@dpd.example'] },
			{ id: 'eg3', name: 'Biuro obsługi klienta', emails: ['bok@mws.example'] },
			{ id: 'eg4', name: 'Kierownik zmiany', emails: ['kierownik.zmiany@mws.example'] }
		],

		// Spedytor wynika z rodzaju nośnika: palety -> Raben, paczki -> DPD
		forwarders: [
			{ id: 'raben', name: 'Raben', kind: 'PALLET', defaultDock: 'DOK 3' },
			{ id: 'dpd', name: 'DPD', kind: 'PARCEL', defaultDock: 'DOK 4' }
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

		// tracking: NONE / BATCH (seria/partia + data ważności) / SERIAL (numer seryjny per sztuka); requiresQc = KJ
		products: [
			{ id: 'p01', sku: 'KLM-310', ean: '5901234100017', name: 'Klej montażowy MS 310 ml', unit: 'szt', unitWeightKg: 0.45, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p02', sku: 'PNM-750', ean: '5901234100024', name: 'Pianka montażowa 750 ml', unit: 'szt', unitWeightKg: 0.9, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p03', sku: 'SIL-280', ean: '5901234100031', name: 'Silikon sanitarny biały 280 ml', unit: 'szt', unitWeightKg: 0.35, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p04', sku: 'TAS-AL50', ean: '5901234100048', name: 'Taśma aluminiowa 50 mm × 50 m', unit: 'rol', unitWeightKg: 0.6, requiresQc: false, tracking: 'NONE' },
			{ id: 'p05', sku: 'RUR-PP20', ean: '5901234100055', name: 'Rura PP-R 20 mm, odc. 4 m', unit: 'szt', unitWeightKg: 0.7, requiresQc: false, tracking: 'NONE' },
			{ id: 'p06', sku: 'KOL-PP20', ean: '5901234100062', name: 'Kolano PP-R 20 mm 90° (op. 50 szt)', unit: 'opak', unitWeightKg: 0.8, requiresQc: false, tracking: 'NONE' },
			{ id: 'p07', sku: 'ZAW-KUL12', ean: '5901234100079', name: 'Zawór kulowy 1/2"', unit: 'szt', unitWeightKg: 0.25, requiresQc: false, tracking: 'NONE' },
			{ id: 'p08', sku: 'WKR-6x60', ean: '5901234100086', name: 'Wkręty do drewna 6×60 (op. 200)', unit: 'opak', unitWeightKg: 1.2, requiresQc: false, tracking: 'NONE' },
			{ id: 'p09', sku: 'KOL-8x50', ean: '5901234100093', name: 'Kołki rozporowe 8×50 (op. 100)', unit: 'opak', unitWeightKg: 0.5, requiresQc: false, tracking: 'NONE' },
			{ id: 'p10', sku: 'ZPR-25', ean: '5901234100109', name: 'Zaprawa klejowa C2TE 25 kg', unit: 'szt', unitWeightKg: 25, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p11', sku: 'GRU-5L', ean: '5901234100116', name: 'Grunt głęboko penetrujący 5 l', unit: 'szt', unitWeightKg: 5.3, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p12', sku: 'FAR-10L', ean: '5901234100123', name: 'Farba lateksowa biała 10 l', unit: 'szt', unitWeightKg: 14, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p13', sku: 'WEL-100', ean: '5901234100130', name: 'Wełna mineralna 100 mm (paczka)', unit: 'opak', unitWeightKg: 9, requiresQc: false, tracking: 'NONE' },
			{ id: 'p14', sku: 'PRF-CD60', ean: '5901234100147', name: 'Profil CD60, 3 m', unit: 'szt', unitWeightKg: 1.5, requiresQc: false, tracking: 'NONE' },
			{ id: 'p15', sku: 'PLY-GKB', ean: '5901234100154', name: 'Płyta g-k 12,5 mm 120×260', unit: 'szt', unitWeightKg: 24, requiresQc: true, tracking: 'NONE' },
			{ id: 'p16', sku: 'SIA-145', ean: '5901234100161', name: 'Siatka z włókna szklanego 1×50 m', unit: 'rol', unitWeightKg: 7.5, requiresQc: false, tracking: 'NONE' },
			{ id: 'p17', sku: 'RKW-NIT', ean: '5901234100178', name: 'Rękawice robocze nitrylowe (op. 12 par)', unit: 'opak', unitWeightKg: 0.9, requiresQc: false, tracking: 'NONE' },
			{ id: 'p18', sku: 'FOL-PE02', ean: '5901234100185', name: 'Folia PE 0,2 mm 4×25 m', unit: 'rol', unitWeightKg: 18, requiresQc: false, tracking: 'NONE' },
			{ id: 'p19', sku: 'LIS-PRZ', ean: '5901234100192', name: 'Listwa przypodłogowa 2,5 m', unit: 'szt', unitWeightKg: 0.6, requiresQc: false, tracking: 'NONE' },
			{ id: 'p20', sku: 'ZST-WC', ean: '5901234100208', name: 'Zestaw instalacyjny WC', unit: 'kpl', unitWeightKg: 6.8, requiresQc: true, tracking: 'NONE' },
			{ id: 'p21', sku: 'PC-8KW', ean: '5901234100215', name: 'Pompa ciepła powietrze-woda 8 kW', unit: 'kpl', unitWeightKg: 95, requiresQc: true, tracking: 'SERIAL' },
			{ id: 'p22', sku: 'KOC-24K', ean: '5901234100222', name: 'Kocioł gazowy kondensacyjny 24 kW', unit: 'szt', unitWeightKg: 38, requiresQc: false, tracking: 'SERIAL' },
			{ id: 'p23', sku: 'WKR-18V', ean: '5901234100239', name: 'Wiertarko-wkrętarka 18 V z 2 akum.', unit: 'kpl', unitWeightKg: 2.4, requiresQc: false, tracking: 'SERIAL' },
			{ id: 'p24', sku: 'GRZ-22-6010', ean: '5901234100246', name: 'Grzejnik płytowy 22 600×1000', unit: 'szt', unitWeightKg: 27, requiresQc: true, tracking: 'NONE' },
			{ id: 'p25', sku: 'KLS-25', ean: '5901234100253', name: 'Klej do styropianu 25 kg', unit: 'szt', unitWeightKg: 25, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p26', sku: 'FUG-5SZ', ean: '5901234100260', name: 'Fuga elastyczna szara 5 kg', unit: 'szt', unitWeightKg: 5, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p27', sku: 'BAT-UMY', ean: '5901234100277', name: 'Bateria umywalkowa stojąca, chrom', unit: 'szt', unitWeightKg: 1.6, requiresQc: true, tracking: 'NONE' },
			{ id: 'p28', sku: 'PV-450', ean: '5901234100284', name: 'Panel fotowoltaiczny 450 W', unit: 'szt', unitWeightKg: 22, requiresQc: true, tracking: 'SERIAL' },
			{ id: 'p29', sku: 'HYD-5KG', ean: '5901234100291', name: 'Hydroizolacja w płynie 5 kg', unit: 'szt', unitWeightKg: 5, requiresQc: false, tracking: 'BATCH' },
			{ id: 'p30', sku: 'GRS-6060', ean: '5901234100307', name: 'Płytki gresowe 60×60 szare (op. 1,44 m²)', unit: 'opak', unitWeightKg: 32, requiresQc: true, tracking: 'BATCH' }
		],

		suppliers: [
			{ id: 's1', name: 'Chemibud Sp. z o.o.', city: 'Kielce' },
			{ id: 's2', name: 'Rurmet Instalacje S.A.', city: 'Wadowice' },
			{ id: 's3', name: 'Gipsar Sp. z o.o.', city: 'Bełchatów' },
			{ id: 's4', name: 'Termex Grzanie S.A.', city: 'Wrocław' },
			{ id: 's5', name: 'Narzędziownia Pro Sp. j.', city: 'Łódź' },
			{ id: 's6', name: 'SolarTech Polska Sp. z o.o.', city: 'Gdynia' },
			{ id: 's7', name: 'Ceramika Wolbórz S.A.', city: 'Wolbórz' },
			{ id: 's8', name: 'Farbex Sp. z o.o.', city: 'Radom' }
		],

		// ZZ – zamówienia zakupu
		purchaseOrders: [
			{ id: 'po01', number: `ZZ/${YM()}/0301`, supplierId: 's1', warehouseId: 'mg01', orderedAt: at(-6, '10:00'), lines: [
				{ id: 'po01-1', productId: 'p01', qty: 120 }, { id: 'po01-2', productId: 'p02', qty: 72 }, { id: 'po01-3', productId: 'p03', qty: 48 }] },
			{ id: 'po02', number: `ZZ/${YM()}/0298`, supplierId: 's5', warehouseId: 'mg01', orderedAt: at(-8, '09:12'), lines: [
				{ id: 'po02-1', productId: 'p08', qty: 40 }, { id: 'po02-2', productId: 'p09', qty: 50 }, { id: 'po02-3', productId: 'p17', qty: 24 }] },
			{ id: 'po03', number: `ZZ/${YM()}/0305`, supplierId: 's2', warehouseId: 'mg01', orderedAt: at(-5, '13:40'), lines: [
				{ id: 'po03-1', productId: 'p07', qty: 60 }, { id: 'po03-2', productId: 'p06', qty: 30 }, { id: 'po03-3', productId: 'p27', qty: 12 }] },
			{ id: 'po04', number: `ZZ/${YM()}/0307`, supplierId: 's3', warehouseId: 'mg01', orderedAt: at(-4, '08:20'), lines: [
				{ id: 'po04-1', productId: 'p14', qty: 200 }, { id: 'po04-2', productId: 'p15', qty: 40 }, { id: 'po04-3', productId: 'p19', qty: 100 }] },
			{ id: 'po05', number: `ZZ/${YM()}/0308`, supplierId: 's3', warehouseId: 'mg01', orderedAt: at(-4, '08:31'), lines: [
				{ id: 'po05-1', productId: 'p16', qty: 10 }, { id: 'po05-2', productId: 'p13', qty: 30 }] },
			{ id: 'po06', number: `ZZ/${YM()}/0310`, supplierId: 's4', warehouseId: 'mg01', orderedAt: at(-7, '11:05'), lines: [
				{ id: 'po06-1', productId: 'p21', qty: 2 }, { id: 'po06-2', productId: 'p22', qty: 3 }, { id: 'po06-3', productId: 'p24', qty: 10 }] },
			{ id: 'po07', number: `ZZ/${YM()}/0311`, supplierId: 's1', warehouseId: 'mg01', orderedAt: at(-3, '09:00'), lines: [
				{ id: 'po07-1', productId: 'p10', qty: 60 }, { id: 'po07-2', productId: 'p25', qty: 40 }, { id: 'po07-3', productId: 'p26', qty: 20 }, { id: 'po07-4', productId: 'p29', qty: 12 }] },
			{ id: 'po08', number: `ZZ/${YM()}/0312`, supplierId: 's6', warehouseId: 'mg01', orderedAt: at(-10, '14:00'), lines: [
				{ id: 'po08-1', productId: 'p28', qty: 12 }] },
			{ id: 'po09', number: `ZZ/${YM()}/0313`, supplierId: 's7', warehouseId: 'mg01', orderedAt: at(-6, '12:30'), lines: [
				{ id: 'po09-1', productId: 'p30', qty: 60 }] },
			{ id: 'po10', number: `ZZ/${YM()}/0314`, supplierId: 's8', warehouseId: 'mg02', orderedAt: at(-3, '15:10'), lines: [
				{ id: 'po10-1', productId: 'p12', qty: 24 }, { id: 'po10-2', productId: 'p18', qty: 10 }] },
			{ id: 'po11', number: `ZZ/${YM()}/0315`, supplierId: 's5', warehouseId: 'mg01', orderedAt: at(-2, '10:45'), lines: [
				{ id: 'po11-1', productId: 'p23', qty: 5 }, { id: 'po11-2', productId: 'p08', qty: 20 }] },
			{ id: 'po12', number: `ZZ/${YM()}/0316`, supplierId: 's2', warehouseId: 'mg01', orderedAt: at(-2, '11:00'), lines: [
				{ id: 'po12-1', productId: 'p05', qty: 200 }, { id: 'po12-2', productId: 'p04', qty: 30 }] },
			{ id: 'po13', number: `ZZ/${YM()}/0317`, supplierId: 's3', warehouseId: 'mg02', orderedAt: at(-1, '09:30'), lines: [
				{ id: 'po13-1', productId: 'p15', qty: 60 }] },
			{ id: 'po14', number: `ZZ/${YM()}/0318`, supplierId: 's1', warehouseId: 'mg01', orderedAt: at(-1, '13:15'), lines: [
				{ id: 'po14-1', productId: 'p01', qty: 200 }, { id: 'po14-2', productId: 'p02', qty: 100 }] }
		],

		// Awizacje – zapowiedziane dostawy (jedno auto, jeden DOK, slot czasowy)
		advices: [
			{ id: 'aw-a1', number: `AW/${YM()}/0412`, date: day(-1), slotFrom: '07:00', slotTo: '08:00', warehouseId: 'mg01', dockId: 'd1', supplierId: 's1', purchaseOrderIds: ['po01'],
				vehicle: { plate: 'TK 4821C', driver: 'Tomasz Lis', phone: '+48 601 220 114' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(-1, '06:52'), note: null },
			{ id: 'aw-a2', number: `AW/${YM()}/0413`, date: day(-1), slotFrom: '10:00', slotTo: '11:00', warehouseId: 'mg01', dockId: 'd2', supplierId: 's5', purchaseOrderIds: ['po02'],
				vehicle: { plate: 'EL 77310', driver: 'Kamil Dąbrowski', phone: '+48 512 449 003' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(-1, '10:05'), note: null },
			{ id: 'aw-b1', number: `AW/${YM()}/0418`, date: day(0), slotFrom: '06:00', slotTo: '07:00', warehouseId: 'mg01', dockId: 'd2', supplierId: 's2', purchaseOrderIds: ['po03'],
				vehicle: { plate: 'KWA 30912', driver: 'Grzegorz Mazur', phone: '+48 698 110 772' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(0, '06:04'), note: 'Dostawca dowiezie resztę drugim autem po 12:00' },
			{ id: 'aw-b2', number: `AW/${YM()}/0419`, date: day(0), slotFrom: '07:00', slotTo: '08:00', warehouseId: 'mg01', dockId: 'd1', supplierId: 's3', purchaseOrderIds: ['po04', 'po05'],
				vehicle: { plate: 'EBE 5H210', driver: 'Robert Kaczmarek', phone: '+48 733 020 551' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(0, '07:12'), note: 'Dłużyce – rozładunek boczny' },
			{ id: 'aw-b3', number: `AW/${YM()}/0420`, date: day(0), slotFrom: '08:00', slotTo: '09:00', warehouseId: 'mg01', dockId: 'd2', supplierId: 's4', purchaseOrderIds: ['po06'],
				vehicle: { plate: 'DW 9K442', driver: 'Paweł Szymański', phone: '+48 604 381 990' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(0, '08:09'), note: null },
			{ id: 'aw-b4', number: `AW/${YM()}/0417`, date: day(0), slotFrom: '06:30', slotTo: '07:30', warehouseId: 'mg01', dockId: 'd1', supplierId: 's1', purchaseOrderIds: ['po07'],
				vehicle: { plate: 'TK 1190A', driver: 'Tomasz Lis', phone: '+48 601 220 114' }, truckStatus: 'POD_DOKIEM', arrivedAt: at(0, '06:21'), note: null },
			{ id: 'aw-b5', number: `AW/${YM()}/0421`, date: day(0), slotFrom: '09:00', slotTo: '10:00', warehouseId: 'mg01', dockId: 'd1', supplierId: 's6', purchaseOrderIds: ['po08'],
				vehicle: { plate: 'GA 82011', driver: 'Michał Wójcik', phone: '+48 502 667 128' }, truckStatus: 'NA_PLACU', arrivedAt: at(0, '08:47'), note: 'Towar delikatny – panele na stojakach' },
			{ id: 'aw-b6', number: `AW/${YM()}/0423`, date: day(0), slotFrom: '13:00', slotTo: '14:00', warehouseId: 'mg01', dockId: 'd1', supplierId: 's7', purchaseOrderIds: ['po09'],
				vehicle: { plate: 'EPI 44K01', driver: 'Adam Krawczyk', phone: '+48 691 004 337' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null },
			{ id: 'aw-b7', number: `AW/${YM()}/0422`, date: day(0), slotFrom: '10:00', slotTo: '11:00', warehouseId: 'mg02', dockId: 'f1', supplierId: 's8', purchaseOrderIds: ['po10'],
				vehicle: { plate: 'WR 6620E', driver: 'Łukasz Pawlak', phone: '+48 788 312 645' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null },
			{ id: 'aw-b8', number: `AW/${YM()}/0424`, date: day(0), slotFrom: '14:30', slotTo: '15:30', warehouseId: 'mg01', dockId: 'd2', supplierId: 's5', purchaseOrderIds: ['po11'],
				vehicle: { plate: 'EL 2N771', driver: 'Kamil Dąbrowski', phone: '+48 512 449 003' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null },
			{ id: 'aw-c1', number: `AW/${YM()}/0426`, date: day(1), slotFrom: '07:00', slotTo: '08:00', warehouseId: 'mg01', dockId: 'd1', supplierId: 's2', purchaseOrderIds: ['po12'],
				vehicle: { plate: 'KWA 30912', driver: 'Grzegorz Mazur', phone: '+48 698 110 772' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null },
			{ id: 'aw-c2', number: `AW/${YM()}/0427`, date: day(1), slotFrom: '11:00', slotTo: '12:00', warehouseId: 'mg02', dockId: 'f1', supplierId: 's3', purchaseOrderIds: ['po13'],
				vehicle: { plate: 'EBE 1C045', driver: 'Robert Kaczmarek', phone: '+48 733 020 551' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null },
			{ id: 'aw-c3', number: `AW/${YM()}/0429`, date: day(2), slotFrom: '08:00', slotTo: '09:00', warehouseId: 'mg01', dockId: 'd2', supplierId: 's1', purchaseOrderIds: ['po14'],
				vehicle: { plate: 'TK 4821C', driver: 'Tomasz Lis', phone: '+48 601 220 114' }, truckStatus: 'AWIZOWANE', arrivedAt: null, note: null }
		],

		// PZ – przyjęcia zewnętrzne
		receipts: [
			{
				id: 'pz-0121', number: `PZ/${YM()}/0121`, adviceId: 'aw-a2', warehouseId: 'mg01', dockId: 'd2', status: 'DONE',
				createdAt: at(-1, '10:12'), createdBy: 'Anna Nowak', closedAt: at(-1, '11:20'), closedBy: 'Anna Nowak',
				lines: [
					{ id: 'pz-0121-1', purchaseOrderId: 'po02', poLineId: 'po02-1', productId: 'p08', expectedQty: 40, receivedQty: 40, batches: [], serials: [], note: null, checkedAt: at(-1, '10:30') },
					{ id: 'pz-0121-2', purchaseOrderId: 'po02', poLineId: 'po02-2', productId: 'p09', expectedQty: 50, receivedQty: 50, batches: [], serials: [], note: null, checkedAt: at(-1, '10:41') },
					{ id: 'pz-0121-3', purchaseOrderId: 'po02', poLineId: 'po02-3', productId: 'p17', expectedQty: 24, receivedQty: 24, batches: [], serials: [], note: null, checkedAt: at(-1, '10:55') }
				],
				approval: null, allocationOrderId: 'zm-0040', labelsPrintedAt: at(-1, '11:22')
			},
			{
				id: 'pz-0122', number: `PZ/${YM()}/0122`, adviceId: 'aw-a1', warehouseId: 'mg01', dockId: 'd1', status: 'DONE',
				createdAt: at(-1, '07:02'), createdBy: 'Jan Kowalski', closedAt: at(-1, '08:40'), closedBy: 'Jan Kowalski',
				lines: [
					{ id: 'pz-0122-1', purchaseOrderId: 'po01', poLineId: 'po01-1', productId: 'p01', expectedQty: 120, receivedQty: 120, batches: [{ batch: 'KL2610-05', expiry: day(400), qty: 120 }], serials: [], note: null, checkedAt: at(-1, '07:30') },
					{ id: 'pz-0122-2', purchaseOrderId: 'po01', poLineId: 'po01-2', productId: 'p02', expectedQty: 72, receivedQty: 70, batches: [{ batch: 'PN2610-19', expiry: day(330), qty: 70 }], serials: [], note: '2 szt. uszkodzone – przebite opakowanie', checkedAt: at(-1, '07:58') },
					{ id: 'pz-0122-3', purchaseOrderId: 'po01', poLineId: 'po01-3', productId: 'p03', expectedQty: 48, receivedQty: 48, batches: [{ batch: 'SL2610-02', expiry: day(360), qty: 48 }], serials: [], note: null, checkedAt: at(-1, '08:20') }
				],
				approval: { by: 'Piotr Wiśniewski', at: at(-1, '08:38'), note: 'Uszkodzenia zgłoszone dostawcy, reklamacja RK/0091' },
				allocationOrderId: 'zm-0041', labelsPrintedAt: null
			},
			{
				id: 'pz-0124', number: `PZ/${YM()}/0124`, adviceId: 'aw-b1', warehouseId: 'mg01', dockId: 'd2', status: 'DONE',
				createdAt: at(0, '06:10'), createdBy: 'Marek Zieliński', closedAt: at(0, '06:55'), closedBy: 'Marek Zieliński',
				lines: [
					{ id: 'pz-0124-1', purchaseOrderId: 'po03', poLineId: 'po03-1', productId: 'p07', expectedQty: 60, receivedQty: 40, batches: [], serials: [], note: null, checkedAt: at(0, '06:25') },
					{ id: 'pz-0124-2', purchaseOrderId: 'po03', poLineId: 'po03-2', productId: 'p06', expectedQty: 30, receivedQty: 20, batches: [], serials: [], note: null, checkedAt: at(0, '06:38') },
					{ id: 'pz-0124-3', purchaseOrderId: 'po03', poLineId: 'po03-3', productId: 'p27', expectedQty: 12, receivedQty: 12, batches: [], serials: [], note: null, checkedAt: at(0, '06:50') }
				],
				approval: { by: 'Piotr Wiśniewski', at: at(0, '06:54'), note: 'Reszta w drugim aucie – ZZ zostaje otwarte' },
				allocationOrderId: 'zm-0042', labelsPrintedAt: null
			},
			{
				id: 'pz-0123', number: `PZ/${YM()}/0123`, adviceId: 'aw-b4', warehouseId: 'mg01', dockId: 'd1', status: 'AWAITING_APPROVAL',
				createdAt: at(0, '06:28'), createdBy: 'Marek Zieliński', closedAt: null, closedBy: null,
				lines: [
					{ id: 'pz-0123-1', purchaseOrderId: 'po07', poLineId: 'po07-1', productId: 'p10', expectedQty: 60, receivedQty: 58, batches: [{ batch: 'ZP2611-002', expiry: day(365), qty: 58 }], serials: [], note: '2 worki rozerwane – odrzucone', checkedAt: at(0, '06:52') },
					{ id: 'pz-0123-2', purchaseOrderId: 'po07', poLineId: 'po07-2', productId: 'p25', expectedQty: 40, receivedQty: 40, batches: [{ batch: 'KS2611-01', expiry: day(300), qty: 30 }, { batch: 'KS2611-02', expiry: day(310), qty: 10 }], serials: [], note: null, checkedAt: at(0, '07:05') },
					{ id: 'pz-0123-3', purchaseOrderId: 'po07', poLineId: 'po07-3', productId: 'p26', expectedQty: 20, receivedQty: 20, batches: [{ batch: 'FG2610-11', expiry: day(540), qty: 20 }], serials: [], note: null, checkedAt: at(0, '07:11') },
					{ id: 'pz-0123-4', purchaseOrderId: 'po07', poLineId: 'po07-4', productId: 'p29', expectedQty: 12, receivedQty: 12, batches: [{ batch: 'HD2610-04', expiry: day(180), qty: 12 }], serials: [], note: null, checkedAt: at(0, '07:16') }
				],
				approval: null, allocationOrderId: null, labelsPrintedAt: null
			},
			{
				id: 'pz-0125', number: `PZ/${YM()}/0125`, adviceId: 'aw-b2', warehouseId: 'mg01', dockId: 'd1', status: 'IN_PROGRESS',
				createdAt: at(0, '07:20'), createdBy: 'Jan Kowalski', closedAt: null, closedBy: null,
				lines: [
					{ id: 'pz-0125-1', purchaseOrderId: 'po04', poLineId: 'po04-1', productId: 'p14', expectedQty: 200, receivedQty: 200, batches: [], serials: [], note: null, checkedAt: at(0, '07:41') },
					{ id: 'pz-0125-2', purchaseOrderId: 'po04', poLineId: 'po04-2', productId: 'p15', expectedQty: 40, receivedQty: 38, batches: [], serials: [], note: '2 płyty z uszkodzonym narożnikiem', checkedAt: at(0, '07:58') },
					{ id: 'pz-0125-3', purchaseOrderId: 'po04', poLineId: 'po04-3', productId: 'p19', expectedQty: 100, receivedQty: 0, batches: [], serials: [], note: null, checkedAt: null },
					{ id: 'pz-0125-4', purchaseOrderId: 'po05', poLineId: 'po05-1', productId: 'p16', expectedQty: 10, receivedQty: 0, batches: [], serials: [], note: null, checkedAt: null },
					{ id: 'pz-0125-5', purchaseOrderId: 'po05', poLineId: 'po05-2', productId: 'p13', expectedQty: 30, receivedQty: 30, batches: [], serials: [], note: null, checkedAt: at(0, '08:06') }
				],
				approval: null, allocationOrderId: null, labelsPrintedAt: null
			},
			{
				id: 'pz-0126', number: `PZ/${YM()}/0126`, adviceId: 'aw-b3', warehouseId: 'mg01', dockId: 'd2', status: 'NEW',
				createdAt: at(0, '08:15'), createdBy: 'Anna Nowak', closedAt: null, closedBy: null,
				lines: [
					{ id: 'pz-0126-1', purchaseOrderId: 'po06', poLineId: 'po06-1', productId: 'p21', expectedQty: 2, receivedQty: 0, batches: [], serials: [], note: null, checkedAt: null },
					{ id: 'pz-0126-2', purchaseOrderId: 'po06', poLineId: 'po06-2', productId: 'p22', expectedQty: 3, receivedQty: 0, batches: [], serials: [], note: null, checkedAt: null },
					{ id: 'pz-0126-3', purchaseOrderId: 'po06', poLineId: 'po06-3', productId: 'p24', expectedQty: 10, receivedQty: 0, batches: [], serials: [], note: null, checkedAt: null }
				],
				approval: null, allocationOrderId: null, labelsPrintedAt: null
			}
		],

		// ZM – zlecenia magazynowe MWS (alokacja z miejsca odstawczego na półki)
		allocationOrders: [
			{
				id: 'zm-0040', number: `ZM/${Y()}/0040`, receiptId: 'pz-0121', warehouseId: 'mg01', createdAt: at(-1, '11:20'), startedAt: at(-1, '11:40'), doneAt: at(-1, '12:15'), deferredLineIds: [],
				lines: [
					{ id: 'zm-0040-1', productId: 'p08', qty: 40, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'A-04-02-B', placements: [{ location: 'A-04-02-B', qty: 40, at: at(-1, '11:52'), by: 'Anna Nowak' }] },
					{ id: 'zm-0040-2', productId: 'p09', qty: 50, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'A-04-02-C', placements: [{ location: 'A-04-02-C', qty: 50, at: at(-1, '11:58'), by: 'Anna Nowak' }] },
					{ id: 'zm-0040-3', productId: 'p17', qty: 24, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'A-06-01-A', placements: [{ location: 'A-06-01-A', qty: 24, at: at(-1, '12:15'), by: 'Anna Nowak' }] }
				]
			},
			{
				id: 'zm-0041', number: `ZM/${Y()}/0041`, receiptId: 'pz-0122', warehouseId: 'mg01', createdAt: at(-1, '08:40'), startedAt: at(-1, '09:10'), doneAt: null, deferredLineIds: [],
				lines: [
					{ id: 'zm-0041-1', productId: 'p01', qty: 120, batch: 'KL2610-05', expiry: day(400), serials: [], fromLocation: 'ODST-D1', suggestedLocation: 'A-03-02-C', placements: [{ location: 'A-03-02-C', qty: 120, at: at(-1, '09:24'), by: 'Jan Kowalski' }] },
					{ id: 'zm-0041-2', productId: 'p02', qty: 70, batch: 'PN2610-19', expiry: day(330), serials: [], fromLocation: 'ODST-D1', suggestedLocation: 'A-03-02-B', placements: [{ location: 'A-03-02-B', qty: 34, at: at(-1, '09:37'), by: 'Jan Kowalski' }] },
					{ id: 'zm-0041-3', productId: 'p03', qty: 48, batch: 'SL2610-02', expiry: day(360), serials: [], fromLocation: 'ODST-D1', suggestedLocation: 'A-03-05-A', placements: [] }
				]
			},
			{
				id: 'zm-0042', number: `ZM/${Y()}/0042`, receiptId: 'pz-0124', warehouseId: 'mg01', createdAt: at(0, '06:55'), startedAt: null, doneAt: null, deferredLineIds: [],
				lines: [
					{ id: 'zm-0042-1', productId: 'p07', qty: 40, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'B-02-01-B', placements: [] },
					{ id: 'zm-0042-2', productId: 'p27', qty: 12, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'B-02-02-B', placements: [] },
					{ id: 'zm-0042-3', productId: 'p06', qty: 20, batch: null, expiry: null, serials: [], fromLocation: 'ODST-D2', suggestedLocation: 'B-02-03-B', placements: [] }
				]
			}
		],

		// MM – przesunięcia międzylokalizacyjne w obrębie magazynu
		transfers: [
			{
				id: 'mm-0049', number: `MM/${Y()}/0049`, warehouseId: 'mg01', source: 'ERP', reason: 'Uzupełnienie strefy kompletacji – profile', status: 'DONE',
				createdAt: at(-1, '06:00'), createdBy: 'ERP (biuro)', startedAt: at(-1, '06:30'), doneAt: at(-1, '06:48'),
				lines: [{ id: 'mm-0049-1', productId: 'p14', fromLocation: 'C-06-04-A', toLocation: 'C-01-01-A', qty: 100, batch: null, moves: [{ qty: 100, to: 'C-01-01-A', at: at(-1, '06:48'), by: 'Marek Zieliński' }] }]
			},
			{
				id: 'mm-0050', number: `MM/${Y()}/0050`, warehouseId: 'mg01', source: 'ERP', reason: 'Uzupełnienie strefy kompletacji – chemia', status: 'IN_PROGRESS',
				createdAt: at(0, '05:45'), createdBy: 'ERP (biuro)', startedAt: at(0, '07:50'), doneAt: null,
				lines: [
					{ id: 'mm-0050-1', productId: 'p10', fromLocation: 'C-06-05-A', toLocation: 'A-01-01-B', qty: 20, batch: 'ZP2609-021', moves: [{ qty: 20, to: 'A-01-01-B', at: at(0, '08:02'), by: 'Jan Kowalski' }] },
					{ id: 'mm-0050-2', productId: 'p01', fromLocation: 'C-06-05-B', toLocation: 'A-03-02-C', qty: 60, batch: 'KL2609-12', moves: [] }
				]
			},
			{
				id: 'mm-0051', number: `MM/${Y()}/0051`, warehouseId: 'mg01', source: 'MWS', reason: 'Uzupełnienie wg progu min/max – B-02-02-B poniżej 10 szt.', status: 'TODO',
				createdAt: at(0, '08:30'), createdBy: 'MWS (automat)', startedAt: null, doneAt: null,
				lines: [{ id: 'mm-0051-1', productId: 'p27', fromLocation: 'B-02-02-A', toLocation: 'B-02-02-B', qty: 12, batch: null, moves: [] }]
			},
			{
				id: 'mm-0052', number: `MM/${Y()}/0052`, warehouseId: 'mg01', source: 'ERP', reason: 'Reorganizacja strefy D – urządzenia', status: 'TODO',
				createdAt: at(0, '07:10'), createdBy: 'ERP (biuro)', startedAt: null, doneAt: null,
				lines: [
					{ id: 'mm-0052-1', productId: 'p23', fromLocation: 'D-02-01-A', toLocation: 'D-02-03-A', qty: 6, batch: null, moves: [] },
					{ id: 'mm-0052-2', productId: 'p22', fromLocation: 'D-01-02-A', toLocation: 'D-01-03-A', qty: 4, batch: null, moves: [] }
				]
			},
			{
				id: 'mm-0053', number: `MM/${Y()}/0053`, warehouseId: 'mg01', source: 'APP', reason: 'Konsolidacja – zwolnienie miejsca B-02-01-B', status: 'DRAFT',
				createdAt: at(0, '09:05'), createdBy: 'Marek Zieliński', startedAt: null, doneAt: null,
				lines: [{ id: 'mm-0053-1', productId: 'p07', fromLocation: 'B-02-01-B', toLocation: 'B-02-01-A', qty: 20, batch: null, moves: [] }]
			}
		],

		// Inwentaryzacje (ze stanem systemowym – magazynier potwierdza albo koryguje)
		inventories: [
			{
				id: 'inw-0006', number: `INW/${Y()}/0006`, warehouseId: 'mg01', name: 'Strefa C – regał 04', dueDate: day(-3), status: 'DONE',
				startedAt: at(-3, '14:00'), doneAt: at(-3, '14:35'), approval: null,
				locations: [
					{ code: 'C-04-01-B', countedAt: at(-3, '14:12'), countedBy: 'Anna Nowak', items: [{ id: 'i6-1', productId: 'p16', batch: null, systemQty: 18, countedQty: 18, extra: false }] },
					{ code: 'C-04-03-A', countedAt: at(-3, '14:30'), countedBy: 'Anna Nowak', items: [{ id: 'i6-2', productId: 'p18', batch: null, systemQty: 9, countedQty: 9, extra: false }] }
				]
			},
			{
				id: 'inw-0007', number: `INW/${Y()}/0007`, warehouseId: 'mg01', name: 'Strefa B – regał 02 (cykliczna)', dueDate: day(0), status: 'TODO',
				startedAt: null, doneAt: null, approval: null,
				locations: [
					{ code: 'B-02-01-A', countedAt: null, countedBy: null, items: [{ id: 'i7-1', productId: 'p07', batch: null, systemQty: 64, countedQty: null, extra: false }] },
					{ code: 'B-02-01-B', countedAt: null, countedBy: null, items: [{ id: 'i7-2', productId: 'p07', batch: null, systemQty: 20, countedQty: null, extra: false }] },
					{ code: 'B-02-02-A', countedAt: null, countedBy: null, items: [{ id: 'i7-3', productId: 'p27', batch: null, systemQty: 24, countedQty: null, extra: false }] },
					{ code: 'B-02-02-B', countedAt: null, countedBy: null, items: [{ id: 'i7-4', productId: 'p27', batch: null, systemQty: 6, countedQty: null, extra: false }] },
					{ code: 'B-02-03-B', countedAt: null, countedBy: null, items: [{ id: 'i7-5', productId: 'p06', batch: null, systemQty: 40, countedQty: null, extra: false }] },
					{ code: 'B-02-04-A', countedAt: null, countedBy: null, items: [] }
				]
			},
			{
				id: 'inw-0008', number: `INW/${Y()}/0008`, warehouseId: 'mg01', name: 'Strefa A – regał 03, chemia (partie)', dueDate: day(0), status: 'IN_PROGRESS',
				startedAt: at(0, '08:40'), doneAt: null, approval: null,
				locations: [
					{ code: 'A-03-02-B', countedAt: null, countedBy: null, items: [
						{ id: 'i8-1', productId: 'p02', batch: 'PN2608-07', systemQty: 120, countedQty: null, extra: false },
						{ id: 'i8-2', productId: 'p02', batch: 'PN2610-19', systemQty: 34, countedQty: null, extra: false }] },
					{ code: 'A-03-02-C', countedAt: at(0, '08:52'), countedBy: 'Jan Kowalski', items: [
						{ id: 'i8-3', productId: 'p01', batch: 'KL2609-12', systemQty: 150, countedQty: 150, extra: false },
						{ id: 'i8-4', productId: 'p01', batch: 'KL2610-05', systemQty: 120, countedQty: 118, extra: false }] },
					{ code: 'A-03-05-A', countedAt: null, countedBy: null, items: [{ id: 'i8-5', productId: 'p03', batch: 'SL2607-44', systemQty: 96, countedQty: null, extra: false }] }
				]
			},
			{
				id: 'inw-0009', number: `INW/${Y()}/0009`, warehouseId: 'mg02', name: 'Franowo – regały 01–02', dueDate: day(2), status: 'TODO',
				startedAt: null, doneAt: null, approval: null,
				locations: [
					{ code: 'P-01-01-A', countedAt: null, countedBy: null, items: [{ id: 'i9-1', productId: 'p15', batch: null, systemQty: 40, countedQty: null, extra: false }] },
					{ code: 'P-01-02-A', countedAt: null, countedBy: null, items: [{ id: 'i9-2', productId: 'p13', batch: null, systemQty: 25, countedQty: null, extra: false }] },
					{ code: 'P-02-01-A', countedAt: null, countedBy: null, items: [{ id: 'i9-3', productId: 'p12', batch: 'FL2605-31', systemQty: 10, countedQty: null, extra: false }] },
					{ code: 'P-02-02-B', countedAt: null, countedBy: null, items: [{ id: 'i9-4', productId: 'p05', batch: null, systemQty: 90, countedQty: null, extra: false }] }
				]
			}
		],

		salesOrders: [
			{ id: 'so-0412', number: 'ZAM/2026/09/0412', customerOrderNumber: 'BM-5521', customerId: 'c1', shipDate: day(1) },
			{ id: 'so-0415', number: 'ZAM/2026/09/0415', customerOrderNumber: 'TI/0934/26', customerId: 'c2', shipDate: day(1) },
			{ id: 'so-0409', number: 'ZAM/2026/09/0409', customerOrderNumber: 'DX-77120', customerId: 'c3', shipDate: day(0) },
			{ id: 'so-0403', number: 'ZAM/2026/09/0403', customerOrderNumber: 'ARK-311', customerId: 'c4', shipDate: day(0) },
			{ id: 'so-0398', number: 'ZAM/2026/09/0398', customerOrderNumber: 'IB-2026-118', customerId: 'c5', shipDate: day(0) },
			{ id: 'so-0395', number: 'ZAM/2026/09/0395', customerOrderNumber: 'TI/0911/26', customerId: 'c2', shipDate: day(0) },
			{ id: 'so-0390', number: 'ZAM/2026/09/0390', customerOrderNumber: 'DX-77004', customerId: 'c3', shipDate: day(-1) }
		],

		pickingOrders: [
			// --- Nowe, biuro zaproponowało nośniki (bez etykiet) ---
			{
				id: 'pk-0871',
				number: 'ZK/2026/0871',
				salesOrderId: 'so-0412',
				approvedAt: at(0, '06:12'),
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
				approvedAt: at(0, '06:12'),
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
				approvedAt: at(0, '07:40'),
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
				approvedAt: at(0, '05:55'),
				lines: [
					{ id: 'l-0866-1', seq: 1, productId: 'p15', location: 'A-05-01-A', qty: 10 },
					{ id: 'l-0866-2', seq: 2, productId: 'p10', location: 'A-01-01-A', qty: 6 },
					{ id: 'l-0866-3', seq: 3, productId: 'p08', location: 'A-04-02-B', qty: 12 },
					{ id: 'l-0866-4', seq: 4, productId: 'p09', location: 'A-04-02-C', qty: 10 },
					{ id: 'l-0866-5', seq: 5, productId: 'p17', location: 'A-06-01-A', qty: 4 }
				],
				deferredLineIds: [],
				startedAt: at(0, '08:05'),
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
				approvedAt: at(-1, '14:30'),
				lines: [
					{ id: 'l-0861-1', seq: 1, productId: 'p20', location: 'B-06-01-A', qty: 8 },
					{ id: 'l-0861-2', seq: 2, productId: 'p05', location: 'B-05-01-A', qty: 30 },
					{ id: 'l-0861-3', seq: 3, productId: 'p07', location: 'B-02-01-A', qty: 16 },
					{ id: 'l-0861-4', seq: 4, productId: 'p06', location: 'B-02-03-B', qty: 12 }
				],
				deferredLineIds: [],
				startedAt: at(0, '06:40'),
				confirmedAt: at(0, '07:32'),
				releasedAt: null,
				shippedAt: null,
				shipmentId: null
			},
			// --- Wydane, częściowo odstawione ---
			{
				id: 'pk-0858',
				number: 'ZK/2026/0858',
				salesOrderId: 'so-0398',
				approvedAt: at(-1, '12:10'),
				lines: [
					{ id: 'l-0858-1', seq: 1, productId: 'p07', location: 'B-02-01-A', qty: 10 },
					{ id: 'l-0858-2', seq: 2, productId: 'p06', location: 'B-02-03-B', qty: 4 },
					{ id: 'l-0858-3', seq: 3, productId: 'p04', location: 'B-03-02-A', qty: 12 },
					{ id: 'l-0858-4', seq: 4, productId: 'p20', location: 'B-06-01-A', qty: 1 }
				],
				deferredLineIds: [],
				startedAt: at(-1, '13:02'),
				confirmedAt: at(-1, '13:40'),
				releasedAt: at(0, '07:15'),
				shippedAt: null,
				shipmentId: null
			},
			// --- Wydane i w całości odstawione na rampę -> gotowe do zamknięcia ---
			{
				id: 'pk-0855',
				number: 'ZK/2026/0855',
				salesOrderId: 'so-0395',
				approvedAt: at(-1, '11:00'),
				lines: [
					{ id: 'l-0855-1', seq: 1, productId: 'p14', location: 'C-01-01-A', qty: 60 },
					{ id: 'l-0855-2', seq: 2, productId: 'p19', location: 'C-01-02-A', qty: 40 },
					{ id: 'l-0855-3', seq: 3, productId: 'p16', location: 'C-04-01-B', qty: 4 },
					{ id: 'l-0855-4', seq: 4, productId: 'p18', location: 'C-04-03-A', qty: 2 }
				],
				deferredLineIds: [],
				startedAt: at(-1, '12:20'),
				confirmedAt: at(-1, '13:05'),
				releasedAt: at(-1, '13:10'),
				shippedAt: null,
				shipmentId: null
			},
			// --- Wysłane wczoraj ---
			{
				id: 'pk-0849',
				number: 'ZK/2026/0849',
				salesOrderId: 'so-0390',
				approvedAt: at(-2, '15:20'),
				lines: [{ id: 'l-0849-1', seq: 1, productId: 'p10', location: 'A-01-01-A', qty: 20 }],
				deferredLineIds: [],
				startedAt: at(-1, '07:00'),
				confirmedAt: at(-1, '07:25'),
				releasedAt: at(-1, '07:30'),
				shippedAt: at(-1, '10:45'),
				shipmentId: 'sh-0212'
			}
		],

		carriers: [
			// ZK/0871 – propozycja biura, bez etykiet
			{ id: 'k-01', code: carrierCode(0, 121), pickingOrderId: 'pk-0871', no: 1, typeId: 'eur', custom: null, proposedByOffice: true, items: [], weightOverrideKg: null, label: null, contentLabel: null, stagedAt: null, dock: null, loadedAt: null },
			{ id: 'k-02', code: carrierCode(0, 122), pickingOrderId: 'pk-0871', no: 2, typeId: 'eur', custom: null, proposedByOffice: true, items: [], weightOverrideKg: null, label: null, contentLabel: null, stagedAt: null, dock: null, loadedAt: null },

			// ZK/0866 – w trakcie
			{
				id: 'k-03', code: carrierCode(0, 117), pickingOrderId: 'pk-0866', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0866-1', qty: 10 }, { lineId: 'l-0866-2', qty: 6 }],
				weightOverrideKg: null, label: { printedAt: at(0, '08:02'), printCount: 1 }, contentLabel: null, stagedAt: null, dock: null, loadedAt: null
			},
			{
				id: 'k-04', code: carrierCode(0, 118), pickingOrderId: 'pk-0866', no: 2, typeId: 'half', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0866-3', qty: 5 }],
				weightOverrideKg: null, label: { printedAt: at(0, '08:02'), printCount: 1 }, contentLabel: null, stagedAt: null, dock: null, loadedAt: null
			},

			// ZK/0861 – skompletowane, k-06 ma nieaktualną etykietę zawartości
			{
				id: 'k-05', code: carrierCode(0, 114), pickingOrderId: 'pk-0861', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0861-1', qty: 8 }, { lineId: 'l-0861-3', qty: 16 }, { lineId: 'l-0861-4', qty: 12 }],
				weightOverrideKg: null, label: { printedAt: at(0, '06:38'), printCount: 1 },
				contentLabel: { printedAt: at(0, '07:30'), signature: 'eur#l-0861-1:8,l-0861-3:16,l-0861-4:12' }, stagedAt: null, dock: null, loadedAt: null
			},
			{
				id: 'k-06', code: carrierCode(0, 115), pickingOrderId: 'pk-0861', no: 2, typeId: null,
				custom: { name: 'Paleta dłużycowa', kind: 'PALLET', lengthCm: 400, widthCm: 80, heightCm: 60, tareKg: 35 }, proposedByOffice: false,
				items: [{ lineId: 'l-0861-2', qty: 30 }],
				weightOverrideKg: null, label: { printedAt: at(0, '06:38'), printCount: 1 },
				contentLabel: { printedAt: at(0, '07:10'), signature: 'custom:Paleta dłużycowa:400x80x60#l-0861-2:20' }, stagedAt: null, dock: null, loadedAt: null
			},

			// ZK/0858 – wydane, jeden karton odstawiony
			{
				id: 'k-07', code: carrierCode(-1, 108), pickingOrderId: 'pk-0858', no: 1, typeId: 'box', custom: null, proposedByOffice: false,
				items: [{ lineId: 'l-0858-1', qty: 10 }],
				weightOverrideKg: null, label: { printedAt: at(-1, '13:00'), printCount: 1 },
				contentLabel: { printedAt: at(-1, '13:38'), signature: 'box#l-0858-1:10' }, stagedAt: at(0, '07:40'), dock: 'DOK 4', loadedAt: null
			},
			{
				id: 'k-08', code: carrierCode(-1, 109), pickingOrderId: 'pk-0858', no: 2, typeId: 'box', custom: null, proposedByOffice: false,
				items: [{ lineId: 'l-0858-2', qty: 4 }, { lineId: 'l-0858-3', qty: 12 }],
				weightOverrideKg: null, label: { printedAt: at(-1, '13:00'), printCount: 1 },
				contentLabel: { printedAt: at(-1, '13:38'), signature: 'box#l-0858-2:4,l-0858-3:12' }, stagedAt: null, dock: null, loadedAt: null
			},
			{
				id: 'k-09', code: carrierCode(-1, 110), pickingOrderId: 'pk-0858', no: 3, typeId: 'box', custom: null, proposedByOffice: false,
				items: [{ lineId: 'l-0858-4', qty: 1 }],
				weightOverrideKg: null, label: { printedAt: at(-1, '13:20'), printCount: 1 },
				contentLabel: { printedAt: at(-1, '13:38'), signature: 'box#l-0858-4:1' }, stagedAt: null, dock: null, loadedAt: null
			},

			// ZK/0855 – wydane, wszystko na rampie
			{
				id: 'k-10', code: carrierCode(-1, 104), pickingOrderId: 'pk-0855', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0855-1', qty: 60 }, { lineId: 'l-0855-2', qty: 40 }],
				weightOverrideKg: null, label: { printedAt: at(-1, '12:15'), printCount: 1 },
				contentLabel: { printedAt: at(-1, '13:00'), signature: 'eur#l-0855-1:60,l-0855-2:40' }, stagedAt: at(-1, '13:30'), dock: 'DOK 3', loadedAt: null
			},
			{
				id: 'k-11', code: carrierCode(-1, 105), pickingOrderId: 'pk-0855', no: 2, typeId: 'half', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0855-3', qty: 4 }, { lineId: 'l-0855-4', qty: 2 }],
				weightOverrideKg: 72, label: { printedAt: at(-1, '12:15'), printCount: 2 },
				contentLabel: { printedAt: at(-1, '13:00'), signature: 'half#l-0855-3:4,l-0855-4:2' }, stagedAt: at(-1, '13:32'), dock: 'DOK 3', loadedAt: null
			},

			// ZK/0849 – wysłane
			{
				id: 'k-12', code: carrierCode(-1, 98), pickingOrderId: 'pk-0849', no: 1, typeId: 'eur', custom: null, proposedByOffice: true,
				items: [{ lineId: 'l-0849-1', qty: 20 }],
				weightOverrideKg: null, label: { printedAt: at(-1, '06:58'), printCount: 1 },
				contentLabel: { printedAt: at(-1, '07:24'), signature: 'eur#l-0849-1:20' }, stagedAt: at(-1, '07:50'), dock: 'DOK 3', loadedAt: at(-1, '10:31')
			}
		],

		shipments: [
			{
				id: 'sh-0212',
				number: `WYS/${Y()}/0212`,
				forwarderId: 'raben',
				salesOrderIds: ['so-0390'],
				carrierIds: ['k-12'],
				waybillNo: 'RAB-7730019244',
				closedAt: at(-1, '10:45'),
				dock: 'DOK 3',
				driver: { name: 'Sławomir Nowicki', plate: 'PO 5512K', signature: null },
				photos: [],
				emails: [{ groupIds: ['eg1', 'eg3'], sentAt: at(-1, '10:46') }],
				withdrawn: [],
				operator: 'Jan Kowalski'
			}
		],

		counters: { carrier: 13, carrierCode: 123, shipment: 213, receipt: 127, allocation: 43, transfer: 54, stock: 500, photo: 1 }
	};
}

// --- symulacja skanera (tylko makieta) --------------------------------------------

let serialSeq = 1000;

/**
 * Kody "z naklejek" do przycisków "symuluj skan" – na prawdziwym urządzeniu przyjdą ze skanera.
 * Numery seryjne/serie wyglądają jak u dostawców (prefiks z indeksu produktu).
 */
export const mockScanner = {
	serial(sku: string): string {
		let prefix = sku.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
		return `${prefix}-${day(0).slice(2, 4)}${String(Date.now()).slice(-4)}${serialSeq++}`;
	},
	batch(sku: string): string {
		let prefix = sku.replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase();
		return `${prefix}${day(0).slice(2, 4)}${day(0).slice(5, 7)}-${String(serialSeq++).slice(-3)}`;
	},
	expiry(): string {
		return day(365);
	},
	/** EAN produktu spoza dostawy – do pokazania komunikatu o błędnym towarze */
	foreignEan: '5909990012345'
};
