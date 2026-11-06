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
}

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
}

export interface Shipment {
	id: string;
	number: string;
	forwarderId: string;
	salesOrderIds: string[];
	carrierIds: string[];
	waybillNo: string;
	closedAt: string;
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
	counters: { carrier: number; carrierCode: number; shipment: number };
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
}

export interface ShipmentDTO extends Shipment {
	forwarder: Forwarder;
	orders: { number: string; customer: string }[];
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
