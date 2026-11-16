<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { acceptReceipt, ApiError, closeReceipt, generateMwsOrder, mockScanner, printReceiptLabels, requestApproval, scanReceiptProduct, setReceiptCarriers, updateReceiptLine, verifySupervisorPin, type ReceiptLineInput } from '$lib/api';
	import type { GoodsLabelDTO, ReceiptLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtCarriers, fmtDate, fmtDiff, plural } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import StatusBadge, { STATUS } from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import SupervisorSheet from '$lib/components/SupervisorSheet.svelte';
	import GoodsLabelsSheet from '$lib/components/GoodsLabelsSheet.svelte';
	import ReceiptDocuments from './ReceiptDocuments.svelte';
	import BatchCorrectionSheet from './BatchCorrectionSheet.svelte';
	import ReceiptLineSheet from './ReceiptLineSheet.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Truck from '@lucide/svelte/icons/truck';
	import Check from '@lucide/svelte/icons/check';
	import Layers from '@lucide/svelte/icons/layers';
	import FileText from '@lucide/svelte/icons/file-text';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Printer from '@lucide/svelte/icons/printer';
	import Lock from '@lucide/svelte/icons/lock';
	import Send from '@lucide/svelte/icons/send';
	import Ban from '@lucide/svelte/icons/ban';

	let { data } = $props();
	let r = $derived(data.receipt);
	let isSupervisor = $derived(data.operator.role === 'KIEROWNIK');
	/** rozładunek zakończony (PZ istnieje) */
	let done = $derived(r.status === 'DONE');
	/** pozycje przyjęte na magazyn – PZ w „Przyjęte” */
	let accepted = $derived(!!r.acceptedAt);
	/** etap „W trakcie”: przyjmowanie pozycji */
	let accepting = $derived(done && !accepted);
	let busy = $state(false);

	// --- korekta serii (po przyjęciu, pozycje z seriami) ---
	let correctingId = $state<string | null>(null);
	let correctOpen = $state(false);
	let correcting = $derived(r.lines.find((l) => l.id === correctingId) ?? null);

	// --- przyjmowanie pozycji (W trakcie) ---
	let editing = $state<ReceiptLineDTO | null>(null);
	let lineOpen = $state(false);
	let unchecked = $derived(r.lines.filter((l) => !l.checked));

	function openLine(l: ReceiptLineDTO) {
		if (accepting) {
			editing = l;
			lineOpen = true;
		} else if (accepted && l.batches.length) {
			correctingId = l.id;
			correctOpen = true;
		}
	}

	async function onScan(code: string): Promise<string | null> {
		try {
			let { lineId } = await scanReceiptProduct(r.id, code);
			openLine(r.lines.find((l) => l.id === lineId)!);
			return null;
		} catch (e) {
			if (e instanceof ApiError) return e.message;
			throw e;
		}
	}

	async function saveLine(input: ReceiptLineInput): Promise<string | null> {
		if (!editing) return null;
		busy = true;
		try {
			await updateReceiptLine(r.id, editing.id, input);
			toast.ok(`${editing.product.sku}: przyjęto ${input.receivedQty} ${editing.product.unit}`);
			lineOpen = false;
			await invalidateAll();
			return null;
		} catch (e) {
			if (e instanceof ApiError) return [e.message, ...e.details].join(' · ');
			toast.error(e);
			return null;
		} finally {
			busy = false;
		}
	}

	let scanHints = $derived([
		...unchecked.slice(0, 3).map((l) => ({ code: l.product.ean, label: l.product.sku })),
		{ code: mockScanner.foreignEan, label: 'obcy EAN' }
	]);

	// „Zakończ przyjęcie”: rozbieżności ilości -> PIN przełożonego
	let acceptOpen = $state(false);
	let acceptApprovalOpen = $state(false);

	async function accept(approval?: { pin: string; note: string }) {
		busy = true;
		try {
			await acceptReceipt(r.id, approval);
			acceptOpen = false;
			acceptApprovalOpen = false;
			toast.ok(`${r.number} przyjęta`, r.allocation ? `${r.allocation.number} trafiło do Alokacji` : 'Towar na stanie');
			await invalidateAll();
		} catch (e) {
			if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
				acceptOpen = false;
				acceptApprovalOpen = true;
			} else toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function approveAccept(pin: string, note: string): Promise<string | null> {
		try {
			let s = await verifySupervisorPin(pin);
			toast.info(`Zatwierdza: ${s.name}`);
			await accept({ pin, note });
			return null;
		} catch (e) {
			return e instanceof ApiError ? e.message : 'Błąd weryfikacji';
		}
	}

	const lineState = (l: ReceiptLineDTO) => (!l.checked ? 'todo' : l.trackingMissing ? 'bad' : l.diff !== 0 ? 'warn' : 'ok');

	// --- rozładunek: liczba przyjętych nośników (jedyne dane od magazyniera) ---
	// palety i paczki liczone osobno, zapisywane razem
	let carriers = $state(untrack(() => ({ ...(r.carriers.received ?? { pallets: r.carriers.advised ?? 0, parcels: 0 }) })));
	let carriersDirty = $derived(carriers.pallets !== r.carriers.received?.pallets || carriers.parcels !== r.carriers.received?.parcels);
	// zapisane nośniki są tylko do odczytu; liczniki pokazujemy po „Edytuj” albo gdy jeszcze nic nie zapisano
	let editingCarriers = $state(untrack(() => r.carriers.received === null));

	function editCarriers() {
		if (r.carriers.received) carriers = { ...r.carriers.received };
		editingCarriers = true;
	}

	function cancelCarriers() {
		if (r.carriers.received) carriers = { ...r.carriers.received };
		editingCarriers = false;
	}

	async function saveCarriers() {
		if (!carriersDirty) return void (editingCarriers = false);
		busy = true;
		try {
			await setReceiptCarriers(r.id, carriers);
			toast.ok(`Zapisano: ${fmtCarriers(carriers)}`);
			await invalidateAll();
			editingCarriers = false;
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	// --- zamknięcie ---
	let closeOpen = $state(false);
	let approvalOpen = $state(false);
	let phase = $state<'idle' | 'generating' | 'success'>('idle');
	let result = $state<{ allocationOrderId: string | null; number: string | null } | null>(null);
	/** Czy po zamknięciu wywołać w Impulsie "generuj zlecenie magazynowe MWS" */
	let generateMws = $state(true);

	async function finish(approval?: { pin: string; note: string }) {
		closeOpen = false;
		approvalOpen = false;
		phase = 'generating';
		try {
			result = await closeReceipt(r.id, { approval, generateMws });
			phase = 'success';
		} catch (e) {
			phase = 'idle';
			if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') approvalOpen = true;
			else toast.error(e);
		}
	}

	async function approve(pin: string, note: string): Promise<string | null> {
		try {
			let s = await verifySupervisorPin(pin);
			toast.info(`Zatwierdza: ${s.name}`);
			await finish({ pin, note });
			return null;
		} catch (e) {
			return e instanceof ApiError ? e.message : 'Błąd weryfikacji';
		}
	}

	async function sendToApproval() {
		busy = true;
		try {
			await requestApproval(r.id, generateMws);
			toast.info('PZ czeka na akceptację przełożonego', generateMws ? 'Po akceptacji: zlecenie MWS' : 'Po akceptacji: bez zlecenia MWS');
			approvalOpen = false;
			closeOpen = false;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function generateLater() {
		phase = 'generating';
		generateMws = true;
		try {
			result = await generateMwsOrder(r.id);
			phase = 'success';
		} catch (e) {
			phase = 'idle';
			toast.error(e);
		}
	}

	// Zamknij z generowaniem MWS / bez; przy różnicy nośników dalej PIN przełożonego
	function choose(mws: boolean) {
		generateMws = mws;
		closeOpen = false;
		if (r.needsApproval) approvalOpen = true;
		else finish();
	}

	// PZ czeka na akceptację – kierownik zatwierdza z wyborem MWS zapamiętanym przy wysłaniu
	function approvePending() {
		generateMws = r.pendingMws ?? true;
		approvalOpen = true;
	}

	// liczba na liczniku = liczba na PZ: niezapisaną zmianę zapisujemy przed podsumowaniem
	async function startClose() {
		if (carriersDirty) {
			busy = true;
			try {
				await setReceiptCarriers(r.id, carriers);
				await invalidateAll();
				editingCarriers = false;
			} catch (e) {
				toast.error(e);
				return;
			} finally {
				busy = false;
			}
		}
		closeOpen = true;
	}

	// --- etykiety ---
	let labels = $state<GoodsLabelDTO[]>([]);
	let labelsOpen = $state(false);

	async function printLabels() {
		busy = true;
		try {
			labels = await printReceiptLabels(r.id);
			labelsOpen = true;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function afterSuccess(to: string) {
		phase = 'idle';
		await goto(to, { invalidateAll: true });
	}

</script>

<!-- PZ istnieje dla magazyniera dopiero po rozładunku – wcześniej ekran opisuje awizację -->
<PageHeader title={done ? r.number : r.advice.number} titleNote={done ? STATUS[r.statusKey]?.[0] : r.status === 'AWAITING_APPROVAL' ? 'Czeka na akceptację' : 'Rozładunek'} subtitle={r.supplier.name} back={!done ? '/dostawy/do-przyjecia' : accepted ? '/dostawy/przyjete' : '/dostawy/w-trakcie'} />

<div class="flex flex-col gap-3 p-3 {accepted ? '' : 'pb-28'}">
	<!-- rozładunek: dane awizacji, dokumenty i nośniki; po rozładunku już niepotrzebne -->
	{#if !done}
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<div class="flex flex-wrap items-center gap-1.5">
				<Badge>{r.warehouse.code} · {r.dock.name}</Badge>
				<ProductFlags flags={r.flags} size="sm" />
			</div>
			<dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
				<div class="col-span-2"><dt class="text-xs text-muted">Okno</dt><dd class="font-semibold">{fmtDate(r.advice.date)} {r.advice.slotFrom}–{r.advice.slotTo}</dd></div>
				<div class="col-span-2"><dt class="text-xs text-muted">Zamówienia zakupu</dt><dd class="font-mono font-semibold">{r.purchaseOrders.map((p) => p.number).join(', ')}</dd></div>
				<div class="col-span-2"><dt class="text-xs text-muted">Auto</dt><dd class="flex items-center gap-1.5 font-semibold"><Truck class="size-4 text-muted" />{r.advice.vehicle.plate} · {r.advice.vehicle.driver}</dd></div>
			</dl>
		</section>
	{/if}

	{#if r.status === 'AWAITING_APPROVAL'}
		<section class="rounded-2xl bg-warn-soft p-4 text-warn">
			<p class="flex items-center gap-2 font-bold"><Hourglass class="size-5" />Czeka na akceptację przełożonego</p>
			<p class="mt-1 text-sm">Nośniki: przyjęto {r.carriers.received ? fmtCarriers(r.carriers.received) : '—'}, awizowano {r.carriers.advised ?? '—'} pal. · {r.pendingMws === false ? 'bez zlecenia MWS' : 'ze zleceniem MWS'}</p>
			{#if isSupervisor}
				<Button variant="primary" class="mt-3 w-full" onclick={approvePending}><ShieldCheck class="size-4" />Zatwierdź rozbieżności</Button>
			{/if}
		</section>
	{/if}

	{#if !done}<ReceiptDocuments receiptId={r.id} number={r.advice.number} documents={r.documents} />{/if}

	{#if done}
		<!-- po rozładunku: zlecenie MWS; alokacja odbywa się w module Alokacja, dopiero po przyjęciu -->
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="text-xs font-bold tracking-wide text-muted uppercase">Zlecenie magazynowe MWS</p>
			{#if r.allocation}
				<div class="mt-1 flex items-center justify-between gap-2">
					<p class="font-mono text-lg font-extrabold">{r.allocation.number}</p>
					{#if accepted}<StatusBadge status={r.allocation.status} label={r.allocation.status === 'DONE' ? 'Zaalokowane' : 'W Alokacji'} />{/if}
				</div>
				{#if accepting}<p class="mt-0.5 text-sm text-muted">Trafi do Alokacji po przyjęciu pozycji.</p>{/if}
			{:else}
				<p class="mt-1 flex items-center gap-2 font-bold"><Ban class="size-5 text-muted" />Nie wygenerowano</p>
				<p class="mt-0.5 text-sm text-muted">Bez zlecenia towar z <b class="text-ink">{r.dock.stagingLocation}</b> nie trafi do Alokacji.</p>
			{/if}
			{#if accepted || r.mwsSkipped}
				<div class="mt-3 grid gap-2 {accepted && r.mwsSkipped ? 'grid-cols-2' : ''}">
					{#if accepted}<Button loading={busy} onclick={printLabels}><Printer class="size-4" />{r.labelsPrintedAt ? 'Drukuj ponownie' : 'Drukuj etykiety'}</Button>{/if}
					{#if r.mwsSkipped}<Button variant="task" onclick={generateLater}><ArrowDownToLine class="size-4" />Generuj ZM</Button>{/if}
				</div>
			{/if}
		</section>
		{#if accepting}
			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<Progress value={r.progress.linesChecked} max={r.progress.lines} label="{r.progress.linesChecked}/{r.progress.lines} poz. sprawdzonych" />
				<p class="mt-3 mb-2 text-sm font-bold">Zeskanuj produkt z dostawy</p>
				<ScanInput placeholder="EAN / indeks produktu" {onScan} hints={scanHints} autofocus={false} />
			</section>
		{/if}
	{:else}
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<div class="flex items-center justify-between gap-2">
				<p class="flex items-center gap-2 text-sm font-bold"><Layers class="size-4 text-muted" />Przyjęte nośniki</p>
				<span class="text-xs text-muted">{r.carriers.advised !== null ? `awizowano: ${r.carriers.advised} ${plural(r.carriers.advised, 'paleta', 'palety', 'palet')}` : 'awizacja bez liczby palet'}</span>
			</div>
			{#if editingCarriers || !r.carriers.received}
				<div class="mt-3 flex flex-col gap-2">
					<div class="flex items-center gap-3">
						<span class="w-16 shrink-0 text-sm font-bold">Palety</span>
						<QtyStepper bind:value={carriers.pallets} min={0} max={999} size="lg" class="flex-1" />
					</div>
					<div class="flex items-center gap-3">
						<span class="w-16 shrink-0 text-sm font-bold">Paczki</span>
						<QtyStepper bind:value={carriers.parcels} min={0} max={999} size="lg" class="flex-1" />
					</div>
					<div class="flex gap-2">
						{#if r.carriers.received}<Button size="lg" class="flex-1" disabled={busy} onclick={cancelCarriers}>Anuluj</Button>{/if}
						<Button variant="primary" size="lg" class="flex-[2]" loading={busy} onclick={saveCarriers}>Zapisz – {fmtCarriers(carriers)}</Button>
					</div>
				</div>
				{#if !r.carriers.received}<p class="mt-2 text-xs text-muted">Policz palety i paczki zdjęte z auta i zapisz.</p>{/if}
			{:else}
				<!-- zapisane: tylko do odczytu -->
				<div class="mt-3 flex items-center gap-3">
					<dl class="grid flex-1 grid-cols-2 gap-2">
						<div class="rounded-xl bg-bg px-3 py-2"><dt class="text-xs text-muted">Palety</dt><dd class="font-mono text-2xl font-extrabold">{r.carriers.received.pallets}</dd></div>
						<div class="rounded-xl bg-bg px-3 py-2"><dt class="text-xs text-muted">Paczki</dt><dd class="font-mono text-2xl font-extrabold">{r.carriers.received.parcels}</dd></div>
					</dl>
					<Button size="lg" class="h-16" onclick={editCarriers}><Pencil class="size-4" />Edytuj</Button>
				</div>
				{#if r.carriers.diff}
					<p class="mt-2 flex gap-2 rounded-xl bg-warn-soft p-2.5 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Różnica palet {fmtDiff(r.carriers.diff)} względem awizacji – zakończenie wymaga potwierdzenia przełożonego.</p>
				{:else}
					<p class="mt-2 flex items-center gap-1.5 text-xs font-bold text-ok"><Check class="size-4" />Zapisano{r.carriers.advised !== null ? ' – zgodne z awizacją' : ''}</p>
				{/if}
			{/if}
		</section>
	{/if}

	<!-- pozycje -->
	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Pozycje ({r.lines.length})</h2>
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each r.lines as l (l.id)}
				{@const clickable = accepting || (accepted && l.batches.length > 0)}
				{@const st = lineState(l)}
				<li class="border-t border-line first:border-0">
					<svelte:element this={clickable ? 'button' : 'div'} type={clickable ? 'button' : undefined} role={clickable ? undefined : 'listitem'} class="flex w-full items-start gap-3 p-3 text-left {clickable ? 'active:bg-bg' : ''}" onclick={clickable ? () => openLine(l) : undefined}>
						{#if accepting}
							<span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full {st === 'ok' ? 'bg-ok text-white' : st === 'warn' ? 'bg-warn text-white' : st === 'bad' ? 'bg-bad text-white' : 'bg-bg text-muted'}">
								{#if st === 'ok'}<Check class="size-4" strokeWidth={3} />{:else if st === 'warn'}<TriangleAlert class="size-4" />{:else if st === 'bad'}<CircleAlert class="size-4" />{:else}<Circle class="size-3" />{/if}
							</span>
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{l.product.name}</span>
							<span class="block font-mono text-xs text-muted">{l.product.sku} · {l.purchaseOrderNumber}</span>
							<span class="mt-1 flex flex-wrap gap-1"><ProductFlags product={l.product} size="sm" /></span>
							{#if l.batches.length}<span class="mt-1 block text-xs text-info">Seria: {l.batches.map((b) => `${b.batch} (${b.qty})`).join(', ')}</span>{/if}
							{#if l.batchCorrections?.length}<span class="mt-0.5 block text-xs text-muted">Poprawiono serię ({l.batchCorrections.length}×), ostatnio {l.batchCorrections.at(-1)!.by}</span>{/if}
							{#if accepted && l.batches.length}<span class="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink-2 underline underline-offset-2"><Pencil class="size-3" />Popraw serię</span>{/if}
							{#if l.serials.length}<span class="mt-1 block text-xs text-ink-2">SN: {l.serials.join(', ')}</span>{/if}
							{#if accepting && l.trackingMissing}<span class="mt-1 block text-xs font-bold text-bad">{l.trackingMissing}</span>{/if}
							{#if l.note}<span class="mt-1 block text-xs text-warn">„{l.note}”</span>{/if}
						</span>
						<span class="text-right font-mono font-extrabold whitespace-nowrap">
							{#if accepting}{l.checked ? l.receivedQty : '–'}<span class="text-muted">/{l.expectedQty}</span>{#if l.checked && l.diff !== 0}<span class="block text-xs font-bold text-warn">{fmtDiff(l.diff)}</span>{/if}
							{:else if accepted && l.diff !== 0}{l.receivedQty}<span class="text-muted">/{l.expectedQty}</span><span class="block text-xs font-bold text-warn">{fmtDiff(l.diff)}</span>
							{:else}{l.expectedQty} <span class="text-sm font-normal text-muted">{l.product.unit}</span>{/if}
						</span>
						{#if accepting}<ChevronRight class="mt-1 size-4 shrink-0 text-muted" />{/if}
					</svelte:element>
				</li>
			{/each}
		</ul>
	</section>
</div>

{#if !done && r.status !== 'AWAITING_APPROVAL'}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3">
			<Button variant="ok" size="lg" class="w-full" loading={busy} onclick={startClose}><Lock class="size-5" />Zakończ rozładunek</Button>
		</div>
	</div>
{/if}

{#if accepting}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3">
			<Button variant={unchecked.length ? 'primary' : 'ok'} size="lg" class="w-full" onclick={() => (acceptOpen = true)}><PackageCheck class="size-5" />Zakończ przyjęcie{unchecked.length ? ` (${r.progress.linesChecked}/${r.progress.lines})` : ''}</Button>
		</div>
	</div>
{/if}

{#if editing}
	{#key editing.id}
		<ReceiptLineSheet bind:open={lineOpen} line={editing} {busy} onSave={saveLine} />
	{/key}
{/if}

<!-- podsumowanie przed przyjęciem -->
<Sheet bind:open={acceptOpen} title="Zakończyć przyjęcie?" description="{r.number} · przyjęto {r.totals.received} z {r.totals.expected}">
	{#if unchecked.length}
		<p class="mb-2 text-sm font-bold text-bad">Najpierw sprawdź pozycje ({unchecked.length}):</p>
		<ul class="flex flex-col gap-2">
			{#each unchecked as l (l.id)}<li class="flex justify-between gap-3 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><span class="truncate">{l.product.name}</span><span class="font-mono whitespace-nowrap">{l.expectedQty} {l.product.unit}</span></li>{/each}
		</ul>
	{:else}
		{#if r.discrepancies.length}
			<p class="mb-2 text-sm font-bold text-warn">Rozbieżności ({r.discrepancies.length}) – wymagają potwierdzenia przełożonego:</p>
			<ul class="divide-y divide-line rounded-xl border border-warn/40 text-sm">
				{#each r.discrepancies as d (d.lineId)}
					<li class="flex items-start justify-between gap-3 px-3 py-2">
						<span class="min-w-0"><b class="block truncate">{d.product.name}</b>{#if d.note}<span class="text-xs text-muted">„{d.note}”</span>{/if}</span>
						<span class="font-mono font-bold whitespace-nowrap text-warn">{d.received}/{d.expected} ({fmtDiff(d.diff)})</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="flex items-center gap-2 rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok"><Check class="size-5" />Wszystkie pozycje zgodne z zamówieniem</p>
		{/if}
		<p class="mt-3 text-sm text-muted">Towar trafi na stan (miejsce odstawcze <b class="text-ink">{r.dock.stagingLocation}</b>){r.allocation ? `, a ${r.allocation.number} do Alokacji` : ''}. PZ przejdzie do „Przyjęte”.</p>
	{/if}
	{#snippet footer()}
		{#if !unchecked.length}
			<Button variant="ok" size="lg" loading={busy} onclick={() => accept()}><PackageCheck class="size-5" />{r.discrepancies.length ? 'Dalej – PIN przełożonego' : 'Zakończ przyjęcie'}</Button>
		{/if}
		<Button variant="ghost" size="lg" onclick={() => (acceptOpen = false)}>Wróć</Button>
	{/snippet}
</Sheet>

<SupervisorSheet bind:open={acceptApprovalOpen} title="Zatwierdzenie rozbieżności" description="{r.number} · przyjęcie na magazyn" onConfirm={approveAccept}>
	<ul class="divide-y divide-line rounded-xl border border-line text-sm">
		{#each r.discrepancies as d (d.lineId)}
			<li class="flex items-start justify-between gap-3 px-3 py-2">
				<span class="min-w-0"><b class="block truncate">{d.product.name}</b>{#if d.note}<span class="text-xs text-muted">„{d.note}”</span>{/if}</span>
				<span class="font-mono font-bold whitespace-nowrap text-warn">{fmtDiff(d.diff)}</span>
			</li>
		{/each}
	</ul>
</SupervisorSheet>

{#if correcting}
	{#key correcting.id}
		<BatchCorrectionSheet bind:open={correctOpen} receiptId={r.id} line={correcting} />
	{/key}
{/if}


<!-- podsumowanie przed zamknięciem -->
<Sheet bind:open={closeOpen} title="Zakończyć rozładunek?" description="{r.advice.number} · {r.supplier.name}">
	{#if r.warnings.length}
		<ul class="mb-3 flex flex-col gap-2">
			{#each r.warnings as w (w)}<li class="flex gap-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />{w}</li>{/each}
		</ul>
	{/if}
	<dl class="divide-y divide-line rounded-xl border border-line text-sm">
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="flex items-center gap-2 text-muted"><Layers class="size-4" />Nośniki przyjęte</dt><dd class="text-right font-bold">{r.carriers.received ? fmtCarriers(r.carriers.received) : '—'}{r.carriers.advised !== null ? ` / awizowano ${r.carriers.advised} pal.` : ''}</dd></div>
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="flex items-center gap-2 text-muted"><FileText class="size-4" />Dokumenty</dt><dd class="font-bold {r.documents.length ? '' : 'text-warn'}">{r.documents.length ? `${r.documents.length} zdj.` : 'brak zdjęć'}</dd></div>
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Pozycje z dokumentu</dt><dd class="font-bold">{r.lines.length}</dd></div>
	</dl>
	{#if r.needsApproval}
		<p class="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Różnica palet {fmtDiff(r.carriers.diff ?? 0)} względem awizacji – po wyborze potrzebny PIN przełożonego.</p>
	{/if}
	<p class="mt-3 text-sm text-muted">Powstanie PZ w „W trakcie” – tam sprawdzisz pozycje (ilości, partie, SN). Zlecenie MWS można też wygenerować później.</p>
	{#snippet footer()}
		<Button variant="ok" size="lg" onclick={() => choose(true)}><ArrowDownToLine class="size-5" />Zamknij z generowaniem MWS</Button>
		<Button size="lg" onclick={() => choose(false)}><Ban class="size-5" />Zamknij bez generowania MWS</Button>
		<Button variant="ghost" size="lg" onclick={() => (closeOpen = false)}>Wróć</Button>
	{/snippet}
</Sheet>

<SupervisorSheet bind:open={approvalOpen} title="Zatwierdzenie różnicy nośników" description="{r.advice.number} · {generateMws ? 'ze zleceniem MWS' : 'bez zlecenia MWS'}" onConfirm={approve}>
	<p class="rounded-xl border border-line px-3 py-2.5 text-sm">Przyjęto <b>{r.carriers.received ? fmtCarriers(r.carriers.received) : '—'}</b>, awizowano <b>{r.carriers.advised} {plural(r.carriers.advised ?? 0, 'paleta', 'palety', 'palet')}</b> <span class="font-mono font-bold text-warn">({fmtDiff(r.carriers.diff ?? 0)})</span></p>
	{#snippet extra()}
		{#if r.status !== 'AWAITING_APPROVAL'}<Button loading={busy} onclick={sendToApproval}><Send class="size-4" />Przełożonego nie ma – wyślij do akceptacji</Button>{/if}
	{/snippet}
</SupervisorSheet>

<GoodsLabelsSheet bind:open={labelsOpen} {labels} printer={data.context.operator.printer} />

<!-- Impuls: generowanie zlecenia MWS -->
{#if phase !== 'idle'}
	<div class="fixed inset-0 z-[55] mx-auto flex max-w-md flex-col bg-ink text-white">
		{#if phase === 'generating'}
			<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
				<LoaderCircle class="size-14 animate-spin text-task" />
				<p class="text-xl font-extrabold">Kończę rozładunek {r.advice.number}</p>
				<p class="text-white/70">{generateMws ? 'Impuls generuje zlecenie magazynowe MWS…' : 'Przekazuję PZ do Impulsa (bez zlecenia MWS)…'}</p>
			</div>
		{:else if result}
			<div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
				<span class="grid size-20 place-items-center rounded-full bg-ok"><Check class="size-11" strokeWidth={3} /></span>
				<p class="mt-2 text-2xl font-extrabold">{r.status === 'DONE' && result.number ? 'Zlecenie wygenerowane' : 'Rozładunek zakończony'}</p>
				<p class="text-white/70">Powstała {r.number} – jest w „W trakcie”. Sprawdź pozycje (ilości, partie, SN), żeby przyjąć towar na magazyn.</p>
				<div class="mt-3 rounded-2xl bg-white/10 px-5 py-3">
					<p class="text-xs tracking-wide text-white/60 uppercase">Zlecenie magazynowe MWS</p>
					{#if result.number}
						<p class="font-mono text-2xl font-extrabold text-task">{result.number}</p>
					{:else}
						<p class="text-lg font-extrabold">Nie generowano</p>
					{/if}
				</div>
			</div>
			<div class="pb-safe flex flex-col gap-2 p-4">
				<Button variant="task" size="xl" onclick={() => afterSuccess(`/dostawy/pz/${r.id}`)}><PackageCheck class="size-6" />Przyjmij pozycje</Button>
				<Button variant="ghost" class="text-white hover:bg-white/10" onclick={() => afterSuccess('/dostawy/do-przyjecia')}>Wróć do dostaw</Button>
			</div>
		{/if}
	</div>
{/if}
