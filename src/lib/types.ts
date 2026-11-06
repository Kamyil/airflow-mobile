// ---------------------------------------------------------------------------
// Encje "bazodanowe" – kształt danych tak, jakby przychodziły z ERP / backendu
// ---------------------------------------------------------------------------

export type CarrierKind = 'PALLET' | 'PARCEL';

/**
 * Spedytor nie jest przypisany do zamówienia – wynika z rodzaju nośników:
 * palety -> spedytor paletowy, paczki -> spedytor paczkowy (bez transportów mieszanych).
 */
export interface Forwarder {
	id: string;
	name: string;
	kind: CarrierKind;
	/** Rampa, na którą standardowo odstawia się nośniki tego spedytora */
	defaultDock: string;
}

export interface CarrierType {
	id: string;
	kind: CarrierKind;
	name: string;
	lengthCm: number;
	widthCm: number;
	heightCm: number;
	tareKg: number;
}

export interface Customer {
	id: string;
	name: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
}

export type ProductUnit = 'szt' | 'opak' | 'kpl' | 'rol';

export interface Product {
	id: string;
	sku: string;
	ean: string;
	name: string;
	unit: ProductUnit;
	unitWeightKg: number;
	/** KJ – produkt wymaga kontroli jakości przy przyjęciu (pobierane z ERP, jak ADR w Chespie) */
	requiresQc: boolean;
	/** Ewidencja: brak / seria (partia, z datą ważności) / numer seryjny per sztuka */
	tracking: Tracking;
}

export type Tracking = 'NONE' | 'BATCH' | 'SERIAL';

export interface SalesOrder {
	id: string;
	number: string;
	/** Numer zamówienia po stronie klienta */
	customerOrderNumber: string;
	customerId: string;
	/** Termin wysyłki */
	shipDate: string;
}

/** Pozycja zlecenia kompletacyjnego – jeden krok: "idź do lokalizacji X, weź N sztuk produktu Y" */
export interface PickLine {
	id: string;
	/** Kolejność pobrań wyznaczona przez ERP (ścieżka kompletacji) */
	seq: number;
	productId: string;
	location: string;
	qty: number;
}

export interface PickingOrder {
	id: string;
	number: string;
	salesOrderId: string;
	approvedAt: string;
	lines: PickLine[];
	/** Pozycje odłożone na później przez magazyniera ("Pomiń") – trafiają na koniec kolejki */
	deferredLineIds: string[];
	startedAt: string | null;
	confirmedAt: string | null;
	releasedAt: string | null;
	shippedAt: string | null;
	shipmentId: string | null;
}

export interface CustomDimensions {
	name: string;
	kind: CarrierKind;
	lengthCm: number;
	widthCm: number;
	heightCm: number;
	tareKg: number;
}

export interface CarrierItem {
	lineId: string;
	qty: number;
}

/** Wydruk etykiety nośnika – etykietę trzeba nakleić zanim cokolwiek się na nim spakuje */
export interface CarrierLabel {
	printedAt: string;
	printCount: number;
}

/** Wydruk zawartości – nieaktualny gdy zmieni się to, co leży na nośniku */
export interface ContentLabel {
	printedAt: string;
	/** Podpis zawartości w chwili wydruku – porównywany z bieżącą zawartością */
	signature: string;
}

export interface Carrier {
	id: string;
	/** Kod nośnika (do 15 znaków) – drukowany jako kod kreskowy i skanowany przy pakowaniu */
	code: string;
	pickingOrderId: string;
	/** Numer porządkowy w obrębie zamówienia – tylko na etykiecie ("1/3") */
	no: number;
	typeId: string | null;
	custom: CustomDimensions | null;
	proposedByOffice: boolean;
	items: CarrierItem[];
	weightOverrideKg: number | null;
	label: CarrierLabel | null;
	contentLabel: ContentLabel | null;
	/** Przygotowanie do wysyłki – wydruk etykiety w widoku Przygotowanie wysyłki */
	stagedAt: string | null;
	/** Miejsce odbioru spedytora */
	dock: string | null;
	/** Załadunek przy wydaniu – zeskanowany na DOKu */
	loadedAt: string | null;
}

export interface Shipment {
	id: string;
	number: string;
	forwarderId: string;
	salesOrderIds: string[];
	carrierIds: string[];
	waybillNo: string;
	closedAt: string;
	dock: string;
	driver: { name: string; plate: string; signature: string | null };
	photos: Photo[];
	emails: { groupIds: string[]; sentAt: string }[];
	/** Zamówienia wycofane z wysyłki po jej zamknięciu (wróciły do "Do wydania") */
	withdrawn: { salesOrderId: string; at: string; by: string }[];
	operator: string;
}

export interface Photo {
	id: string;
	/** data URL (zmniejszone zdjęcie) – w makiecie trzymane lokalnie */
	src: string;
	takenAt: string;
}

export interface EmailGroup {
	id: string;
	name: string;
	emails: string[];
	/** Grupa spedytora – zaznaczana domyślnie przy jego wydaniach */
	forwarderId: string | null;
	/** Zawsze zaznaczona domyślnie */
	always: boolean;
}

export interface Db {
	forwarders: Forwarder[];
	carrierTypes: CarrierType[];
	customers: Customer[];
	products: Product[];
	salesOrders: SalesOrder[];
	pickingOrders: PickingOrder[];
	carriers: Carrier[];
	shipments: Shipment[];
	operator: { name: string; device: string; printer: string };
	counters: Counters;

	// --- część magazynowa / awizacyjna ---
	operators: Operator[];
	warehouses: Warehouse[];
	docks: Dock[];
	locations: Location[];
	stock: StockItem[];
	suppliers: Supplier[];
	purchaseOrders: PurchaseOrder[];
	advices: Advice[];
	receipts: Receipt[];
	allocationOrders: AllocationOrder[];
	transfers: Transfer[];
	inventories: InventoryCount[];
	emailGroups: EmailGroup[];
	/** Dzień, w którym wygenerowano dane – po zmianie dnia makieta sama się resetuje */
	seededOn: string;
}

export interface Counters {
	carrier: number;
	carrierCode: number;
	shipment: number;
	receipt: number;
	allocation: number;
	transfer: number;
	stock: number;
	photo: number;
}

// ---------------------------------------------------------------------------
// DTO – to, co zwraca "API" do widoków (wyliczone po stronie "backendu")
// ---------------------------------------------------------------------------

export interface CarrierDTO {
	id: string;
	code: string;
	no: number;
	/** Liczba nośników w zamówieniu (na etykiecie "no/of") */
	of: number;
	kind: CarrierKind;
	name: string;
	typeId: string | null;
	custom: CustomDimensions | null;
	dimensions: string;
	proposedByOffice: boolean;
	items: CarrierItemDTO[];
	totalQty: number;
	weightKg: number;
	computedWeightKg: number;
	weightOverrideKg: number | null;
	hasLabel: boolean;
	/** Zawartość zmieniła się po wydruku etykiety zawartości */
	contentLabelOutdated: boolean;
	contentLabelMissing: boolean;
	stagedAt: string | null;
	dock: string | null;
	loadedAt: string | null;
}

export interface CarrierItemDTO {
	lineId: string;
	qty: number;
	product: Product;
	location: string;
}

export interface PickLineDTO {
	id: string;
	seq: number;
	product: Product;
	location: string;
	qty: number;
	packedQty: number;
	remainingQty: number;
	deferred: boolean;
	/** Gdzie leży już spakowany towar z tej pozycji */
	packedOn: { carrierId: string; carrierCode: string; qty: number }[];
}

export interface Progress {
	lines: number;
	linesDone: number;
}

export interface PickingOrderSummaryDTO {
	id: string;
	number: string;
	approvedAt: string;
	released: boolean;
	salesOrder: SalesOrder;
	customer: Customer;
	/** Znany dopiero, gdy zamówienie ma nośnik */
	forwarder: Forwarder | null;
	progress: Progress;
	carriers: CarrierDTO[];
	carriersWithoutLabel: number;
	releaseBlockers: string[];
}

export interface PickingOrderDetailDTO extends PickingOrderSummaryDTO {
	/** Rodzaj nośników w zamówieniu (null = brak nośników, można wybrać dowolny) */
	carrierKind: CarrierKind | null;
	carrierTypes: CarrierType[];
	forwarders: Forwarder[];
	/** Wszystkie pozycje w kolejności ERP */
	lines: PickLineDTO[];
	/** Niespakowane pozycje w kolejności pobrań (odłożone na końcu) */
	queue: PickLineDTO[];
	/** Pierwsza pozycja z kolejki – "co teraz robić" */
	current: PickLineDTO | null;
}

export interface OrderReadiness {
	salesOrder: SalesOrder;
	customer: Customer;
	forwarder: Forwarder;
	pickingOrders: { id: string; number: string; released: boolean; progress: Progress; carriers: CarrierDTO[] }[];
	carriersTotal: number;
	carriersStaged: number;
	weightKg: number;
	/** Wszystkie zlecenia wydane i wszystkie nośniki odstawione */
	ready: boolean;
	waitingFor: string[];
	/** Załadunek przy wydaniu */
	carriersLoaded: number;
}

export interface ShipmentDTO extends Shipment {
	forwarder: Forwarder;
	orders: { id: string; number: string; customer: string; withdrawn: boolean; carriers: CarrierDTO[] }[];
	emailLog: { groups: string[]; sentAt: string }[];
	carriers: number;
	weightKg: number;
}

export interface LabelDTO {
	carrierId: string;
	code: string;
	no: number;
	of: number;
	carrierName: string;
	dimensions: string;
	weightKg: number;
	customer: Customer;
	forwarder: Forwarder;
	salesOrderNumber: string;
	customerOrderNumber: string;
	pickingOrderNumber: string;
	shipDate: string;
	withContent: boolean;
	items: { sku: string; name: string; qty: number; unit: ProductUnit }[];
	printedAt: string;
	printCount: number;
}

// ---------------------------------------------------------------------------
// Operatorzy, magazyny, lokalizacje, stany
// ---------------------------------------------------------------------------

export type OperatorRole = 'MAGAZYNIER' | 'KIEROWNIK';

export interface Operator {
	id: string;
	name: string;
	/** 4-cyfrowy PIN – szybkie logowanie na urządzeniu (jak w dok-app) */
	pin: string;
	role: OperatorRole;
}

export interface Warehouse {
	id: string;
	code: string;
	name: string;
	city: string;
}

export interface Dock {
	id: string;
	warehouseId: string;
	name: string;
	purpose: 'IN' | 'OUT' | 'BOTH';
	/** Miejsce odstawcze przy DOKu – tu ląduje przyjęty towar przed alokacją */
	stagingLocation: string;
}

export type LocationKind = 'STORAGE' | 'STAGING';

export interface Location {
	code: string;
	warehouseId: string;
	kind: LocationKind;
	zone: string;
	/** Kolejność na ścieżce magazynowej (Impuls podpowiada trasę wg niej) */
	seq: number;
}

export interface StockItem {
	id: string;
	warehouseId: string;
	location: string;
	productId: string;
	qty: number;
	batch: string | null;
	expiry: string | null;
	serials: string[];
}

// ---------------------------------------------------------------------------
// Dostawy: awizacje, zamówienia zakupu, PZ
// ---------------------------------------------------------------------------

export interface Supplier {
	id: string;
	name: string;
	city: string;
}

export interface PurchaseOrderLine {
	id: string;
	productId: string;
	qty: number;
}

/** ZZ – zamówienie zakupu */
export interface PurchaseOrder {
	id: string;
	number: string;
	supplierId: string;
	warehouseId: string;
	orderedAt: string;
	lines: PurchaseOrderLine[];
}

export type TruckStatus = 'AWIZOWANE' | 'NA_PLACU' | 'POD_DOKIEM';

export interface Advice {
	id: string;
	number: string;
	/** Dzień dostawy (YYYY-MM-DD) */
	date: string;
	slotFrom: string;
	slotTo: string;
	warehouseId: string;
	dockId: string;
	supplierId: string;
	/** Jedna awizacja (jedno auto) może obejmować kilka ZZ */
	purchaseOrderIds: string[];
	vehicle: { plate: string; driver: string; phone: string };
	truckStatus: TruckStatus;
	arrivedAt: string | null;
	note: string | null;
}

export type ReceiptStatus = 'NEW' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'DONE';

export interface BatchEntry {
	batch: string;
	expiry: string | null;
	qty: number;
}

export interface ReceiptLine {
	id: string;
	purchaseOrderId: string;
	poLineId: string;
	productId: string;
	/** Ile zostało do przyjęcia z ZZ w chwili utworzenia PZ */
	expectedQty: number;
	receivedQty: number;
	batches: BatchEntry[];
	serials: string[];
	note: string | null;
	checkedAt: string | null;
}

export interface Approval {
	by: string;
	at: string;
	note: string;
}

/** PZ – przyjęcie zewnętrzne */
export interface Receipt {
	id: string;
	number: string;
	adviceId: string;
	warehouseId: string;
	dockId: string;
	status: ReceiptStatus;
	createdAt: string;
	createdBy: string;
	closedAt: string | null;
	closedBy: string | null;
	lines: ReceiptLine[];
	/** Zatwierdzenie rozbieżności przez przełożonego */
	approval: Approval | null;
	/** Zlecenie magazynowe MWS wygenerowane przez Impuls po zamknięciu */
	allocationOrderId: string | null;
	labelsPrintedAt: string | null;
}

// ---------------------------------------------------------------------------
// Alokacja (zlecenie magazynowe MWS: miejsce odstawcze -> półka)
// ---------------------------------------------------------------------------

export interface Placement {
	location: string;
	qty: number;
	at: string;
	by: string;
}

export interface PutawayLine {
	id: string;
	productId: string;
	qty: number;
	batch: string | null;
	expiry: string | null;
	serials: string[];
	fromLocation: string;
	/** Podpowiedź Impulsa – gdzie odłożyć */
	suggestedLocation: string;
	placements: Placement[];
}

export interface AllocationOrder {
	id: string;
	number: string;
	receiptId: string;
	warehouseId: string;
	createdAt: string;
	startedAt: string | null;
	doneAt: string | null;
	lines: PutawayLine[];
	deferredLineIds: string[];
}

// ---------------------------------------------------------------------------
// Przesunięcia (MM w obrębie magazynu)
// ---------------------------------------------------------------------------

export type TransferSource = 'ERP' | 'MWS' | 'APP';
export type TransferStatus = 'DRAFT' | 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface TransferMove {
	qty: number;
	to: string;
	at: string;
	by: string;
}

export interface TransferLine {
	id: string;
	productId: string;
	fromLocation: string;
	/** Docelowa lokalizacja z dokumentu (null = magazynier wybiera sam) */
	toLocation: string | null;
	qty: number;
	batch: string | null;
	moves: TransferMove[];
}

export interface Transfer {
	id: string;
	number: string;
	warehouseId: string;
	source: TransferSource;
	reason: string;
	status: TransferStatus;
	createdAt: string;
	createdBy: string;
	startedAt: string | null;
	doneAt: string | null;
	lines: TransferLine[];
}

// ---------------------------------------------------------------------------
// Inwentaryzacja (ze stanem systemowym)
// ---------------------------------------------------------------------------

export interface InventoryItem {
	id: string;
	productId: string;
	batch: string | null;
	systemQty: number;
	countedQty: number | null;
	/** Produkt znaleziony na lokalizacji, którego nie było w systemie */
	extra: boolean;
}

export interface InventoryLocation {
	code: string;
	items: InventoryItem[];
	countedAt: string | null;
	countedBy: string | null;
}

export type InventoryStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface InventoryCount {
	id: string;
	number: string;
	warehouseId: string;
	name: string;
	dueDate: string;
	status: InventoryStatus;
	startedAt: string | null;
	doneAt: string | null;
	approval: Approval | null;
	locations: InventoryLocation[];
}

// ---------------------------------------------------------------------------
// DTO – część magazynowa (wyliczane w $lib/mock/*, widoki niczego nie liczą)
// ---------------------------------------------------------------------------

export interface ProductFlags {
	qc: boolean;
	batch: boolean;
	serial: boolean;
}

export interface RefsDTO {
	warehouses: Warehouse[];
	docks: Dock[];
}

export interface ContextDTO {
	operator: Db['operator'];
	counts: {
		deliveries: number;
		receiptsOpen: number;
		allocation: number;
		transfers: number;
		picking: number;
		dispatch: number;
		inventory: number;
	};
	refs: RefsDTO;
}

export interface AdviceDTO {
	id: string;
	number: string;
	date: string;
	slotFrom: string;
	slotTo: string;
	warehouse: Warehouse;
	dock: Dock;
	supplier: Supplier;
	vehicle: Advice['vehicle'];
	truckStatus: TruckStatus;
	arrivedAt: string | null;
	note: string | null;
	purchaseOrders: { id: string; number: string; lines: number }[];
	lines: number;
	orderedQty: number;
	receivedQty: number;
	remainingQty: number;
	partiallyReceived: boolean;
	fullyReceived: boolean;
	openReceipt: { id: string; number: string; status: ReceiptStatus } | null;
	receipts: { id: string; number: string; status: ReceiptStatus }[];
	/** Slot minął, a auta nie ma */
	late: boolean;
	flags: ProductFlags;
}

export interface ReceiptLineDTO extends ReceiptLine {
	product: Product;
	purchaseOrderNumber: string;
	diff: number;
	checked: boolean;
	/** Brakujące dane serii/SN (null = komplet) */
	trackingMissing: string | null;
}

export interface Discrepancy {
	lineId: string;
	product: Product;
	expected: number;
	received: number;
	diff: number;
	note: string | null;
}

export type AllocationStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface ReceiptDTO {
	id: string;
	number: string;
	status: ReceiptStatus;
	advice: { id: string; number: string; slotFrom: string; slotTo: string; date: string; vehicle: Advice['vehicle'] };
	warehouse: Warehouse;
	dock: Dock;
	supplier: Supplier;
	purchaseOrders: { id: string; number: string }[];
	createdAt: string;
	createdBy: string;
	closedAt: string | null;
	closedBy: string | null;
	approval: Approval | null;
	lines: ReceiptLineDTO[];
	progress: { lines: number; linesChecked: number };
	totals: { expected: number; received: number };
	discrepancies: Discrepancy[];
	/** Co blokuje zamknięcie PZ */
	blockers: string[];
	allocation: { id: string; number: string; status: AllocationStatus; linesDone: number; lines: number } | null;
	labelsPrintedAt: string | null;
	flags: ProductFlags;
}

export interface GoodsLabelDTO {
	id: string;
	product: Product;
	qty: number;
	batch: string | null;
	expiry: string | null;
	serial: string | null;
	receiptNumber: string;
	supplier: string;
	location: string;
	printedAt: string;
}

export interface PutawayLineDTO extends PutawayLine {
	seq: number;
	product: Product;
	placedQty: number;
	remainingQty: number;
	deferred: boolean;
}

export interface AllocationSummaryDTO {
	id: string;
	number: string;
	status: AllocationStatus;
	receipt: { id: string; number: string };
	supplier: Supplier;
	warehouse: Warehouse;
	createdAt: string;
	startedAt: string | null;
	doneAt: string | null;
	progress: { lines: number; linesDone: number; qty: number; qtyDone: number };
	fromLocations: string[];
	flags: ProductFlags;
}

export interface AllocationDetailDTO extends AllocationSummaryDTO {
	lines: PutawayLineDTO[];
	queue: PutawayLineDTO[];
	current: PutawayLineDTO | null;
}

export interface TransferLineDTO extends TransferLine {
	product: Product;
	movedQty: number;
	remainingQty: number;
	/** Aktualny stan na lokalizacji źródłowej */
	availableQty: number;
	/** Cel z dokumentu albo podpowiedź MWS, gdy dokument nie wskazuje celu */
	suggestedTo: string;
}

export interface TransferDTO extends Omit<Transfer, 'lines'> {
	warehouse: Warehouse;
	lines: TransferLineDTO[];
	progress: { lines: number; linesDone: number };
	current: TransferLineDTO | null;
}

export interface StockRowDTO extends StockItem {
	product: Product;
}

export interface LocationStockDTO {
	location: Location;
	items: StockRowDTO[];
}

export interface InventoryItemDTO extends InventoryItem {
	product: Product;
	diff: number | null;
}

export interface InventoryLocationDTO {
	code: string;
	items: InventoryItemDTO[];
	counted: boolean;
	countedAt: string | null;
	countedBy: string | null;
	diffs: number;
}

export interface InventoryDiffDTO {
	location: string;
	product: Product;
	batch: string | null;
	systemQty: number;
	countedQty: number;
	diff: number;
}

export interface InventoryDTO extends Omit<InventoryCount, 'locations'> {
	warehouse: Warehouse;
	locations: InventoryLocationDTO[];
	progress: { locations: number; counted: number };
	diffs: InventoryDiffDTO[];
}

export interface DispatchGroupDTO {
	forwarder: Forwarder;
	dock: string;
	orders: OrderReadiness[];
	readyOrders: number;
	carriersReady: number;
	carriersLoaded: number;
	/** Zamówienia w całości załadowane – pojadą po finalizacji */
	loadedOrders: number;
	/** Zamówienia załadowane częściowo – blokują finalizację */
	partialOrders: string[];
	weightLoadedKg: number;
}

export interface AdviceDetailDTO extends AdviceDTO {
	items: { product: string; sku: string; ordered: number; received: number; poNumber: string }[];
}
