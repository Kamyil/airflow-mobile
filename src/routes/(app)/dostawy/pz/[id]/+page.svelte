<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, closeReceipt, mockScanner, printReceiptLabels, requestApproval, scanReceiptProduct, updateReceiptLine, verifySupervisorPin, type ReceiptLineInput } from '$lib/api';
	import type { GoodsLabelDTO, ReceiptLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate, fmtDateTime, fmtDiff, fmtTime } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import SupervisorSheet from '$lib/components/SupervisorSheet.svelte';
	import GoodsLabelsSheet from '$lib/components/GoodsLabelsSheet.svelte';
	import ReceiptLineSheet from './ReceiptLineSheet.svelte';
	import Truck from '@lucide/svelte/icons/truck';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Printer from '@lucide/svelte/icons/printer';
	import Lock from '@lucide/svelte/icons/lock';
	import Send from '@lucide/svelte/icons/send';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { data } = $props();
	let r = $derived(data.receipt);
	let done = $derived(r.status === 'DONE');
	let busy = $state(false);

	// --- pozycja ---
	let editing = $state<ReceiptLineDTO | null>(null);
	let lineOpen = $state(false);

	function openLine(l: ReceiptLineDTO) {
		if (done) return;
		editing = l;
		lineOpen = true;
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

	let hints = $derived([
		...r.lines.filter((l) => !l.checked).slice(0, 3).map((l) => ({ code: l.product.ean, label: l.product.sku })),
		{ code: mockScanner.foreignEan, label: 'obcy EAN' }
	]);

	// --- zamknięcie ---
	let closeOpen = $state(false);
	let approvalOpen = $state(false);
	let phase = $state<'idle' | 'generating' | 'success'>('idle');
	let result = $state<{ allocationOrderId: string; number: string } | null>(null);

	async function finish(approval?: { pin: string; note: string }) {
		closeOpen = false;
		approvalOpen = false;
		phase = 'generating';
		try {
			result = await closeReceipt(r.id, approval);
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
			await requestApproval(r.id);
			toast.info('PZ czeka na akceptację przełożonego');
			approvalOpen = false;
			closeOpen = false;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	function startClose() {
		if (r.status === 'AWAITING_APPROVAL' && !r.blockers.length) approvalOpen = true;
		else closeOpen = true;
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

	const lineState = (l: ReceiptLineDTO) => (!l.checked ? 'todo' : l.trackingMissing ? 'bad' : l.diff !== 0 ? 'warn' : 'ok');
</script>

<PageHeader title={r.number} subtitle={r.supplier.name} back={done ? '/dostawy/przyjete' : '/dostawy/w-trakcie'} />

<div class="flex flex-col gap-3 p-3 {done ? '' : 'pb-28'}">
	<!-- nagłówek dostawy -->
	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<div class="flex flex-wrap items-center gap-1.5">
			<StatusBadge status={r.status} />
			<Badge>{r.warehouse.code} · {r.dock.name}</Badge>
			<ProductFlags flags={r.flags} size="sm" />
		</div>
		<dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
			<div><dt class="text-xs text-muted">Awizacja</dt><dd class="font-mono font-semibold">{r.advice.number}</dd></div>
			<div><dt class="text-xs text-muted">Okno</dt><dd class="font-semibold">{fmtDate(r.advice.date)} {r.advice.slotFrom}–{r.advice.slotTo}</dd></div>
			<div class="col-span-2"><dt class="text-xs text-muted">Zamówienia zakupu</dt><dd class="font-mono font-semibold">{r.purchaseOrders.map((p) => p.number).join(', ')}</dd></div>
			<div class="col-span-2"><dt class="text-xs text-muted">Auto</dt><dd class="flex items-center gap-1.5 font-semibold"><Truck class="size-4 text-muted" />{r.advice.vehicle.plate} · {r.advice.vehicle.driver}</dd></div>
		</dl>
		{#if !done}
			<div class="mt-3"><Progress value={r.progress.linesChecked} max={r.progress.lines} label="{r.progress.linesChecked}/{r.progress.lines} poz. sprawdzonych" /></div>
		{/if}
	</section>

	{#if r.status === 'AWAITING_APPROVAL'}
		<section class="rounded-2xl bg-warn-soft p-4 text-warn">
			<p class="flex items-center gap-2 font-bold"><Hourglass class="size-5" />Czeka na akceptację przełożonego</p>
			<p class="mt-1 text-sm">Rozbieżności: {r.discrepancies.length}. Przełożony może zatwierdzić PIN-em na tym urządzeniu.</p>
			<Button variant="primary" class="mt-3 w-full" onclick={() => (approvalOpen = true)}><ShieldCheck class="size-4" />Zatwierdź PIN-em przełożonego</Button>
		</section>
	{/if}

	{#if done}
		<!-- PZ zrealizowana: MWS, alokacja, etykiety -->
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="flex items-center gap-2 font-bold text-ok"><CircleCheckBig class="size-5" />Zrealizowana {fmtDateTime(r.closedAt!)}</p>
			<p class="mt-0.5 text-sm text-muted">Zamknął(a): {r.closedBy} · przyjęto {r.totals.received} z {r.totals.expected}</p>
			{#if r.approval}
				<div class="mt-3 rounded-xl bg-info-soft p-3 text-sm text-info">
					<p class="flex items-center gap-2 font-bold"><ShieldCheck class="size-4" />Rozbieżności zatwierdził(a) {r.approval.by}, {fmtTime(r.approval.at)}</p>
					{#if r.approval.note}<p class="mt-0.5">„{r.approval.note}”</p>{/if}
				</div>
			{/if}
		</section>
		{#if r.allocation}
			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<p class="text-xs font-bold tracking-wide text-muted uppercase">Zlecenie magazynowe MWS</p>
				<div class="mt-1 flex items-center justify-between gap-2">
					<p class="font-mono text-lg font-extrabold">{r.allocation.number}</p>
					<StatusBadge status={r.allocation.status} label={r.allocation.status === 'DONE' ? 'Zaalokowane' : r.allocation.status === 'TODO' ? 'Do alokacji' : 'Alokacja w trakcie'} />
				</div>
				<div class="mt-2"><Progress value={r.allocation.linesDone} max={r.allocation.lines} label="{r.allocation.linesDone}/{r.allocation.lines} poz. na półkach" /></div>
				<div class="mt-3 grid grid-cols-2 gap-2">
					<Button loading={busy} onclick={printLabels}><Printer class="size-4" />{r.labelsPrintedAt ? 'Drukuj ponownie' : 'Drukuj etykiety'}</Button>
					<Button variant={r.allocation.status === 'DONE' ? 'secondary' : 'task'} href="/alokacja/{r.allocation.id}"><ArrowDownToLine class="size-4" />{r.allocation.status === 'DONE' ? 'Podgląd' : 'Alokuj'}</Button>
				</div>
			</section>
		{/if}
	{:else}
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="mb-2 text-sm font-bold">Zeskanuj produkt z dostawy</p>
			<ScanInput placeholder="EAN / indeks produktu" {onScan} {hints} autofocus={false} />
		</section>
	{/if}

	<!-- pozycje -->
	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Pozycje ({r.lines.length})</h2>
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each r.lines as l (l.id)}
				{@const st = lineState(l)}
				<li class="border-t border-line first:border-0">
					<button type="button" class="flex w-full items-start gap-3 p-3 text-left {done ? '' : 'active:bg-bg'}" onclick={() => openLine(l)}>
						<span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full {st === 'ok' ? 'bg-ok text-white' : st === 'warn' ? 'bg-warn text-white' : st === 'bad' ? 'bg-bad text-white' : 'bg-bg text-muted'}">
							{#if st === 'ok'}<Check class="size-4" strokeWidth={3} />{:else if st === 'warn'}<TriangleAlert class="size-4" />{:else if st === 'bad'}<CircleAlert class="size-4" />{:else}<Circle class="size-3" />{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{l.product.name}</span>
							<span class="block font-mono text-xs text-muted">{l.product.sku} · {l.purchaseOrderNumber}</span>
							<span class="mt-1 flex flex-wrap gap-1"><ProductFlags product={l.product} size="sm" /></span>
							{#if l.batches.length}<span class="mt-1 block text-xs text-info">Seria: {l.batches.map((b) => `${b.batch} (${b.qty})`).join(', ')}</span>{/if}
							{#if l.serials.length}<span class="mt-1 block text-xs text-ink-2">SN: {l.serials.join(', ')}</span>{/if}
							{#if l.trackingMissing}<span class="mt-1 block text-xs font-bold text-bad">{l.trackingMissing}</span>{/if}
							{#if l.note}<span class="mt-1 block text-xs text-warn">„{l.note}”</span>{/if}
						</span>
						<span class="text-right">
							<span class="block font-mono font-extrabold whitespace-nowrap">{l.checked ? l.receivedQty : '–'}<span class="text-muted">/{l.expectedQty}</span></span>
							{#if l.checked && l.diff !== 0}<span class="block text-xs font-bold text-warn">{fmtDiff(l.diff)}</span>{/if}
						</span>
						{#if !done}<ChevronRight class="mt-1 size-4 shrink-0 text-muted" />{/if}
					</button>
				</li>
			{/each}
		</ul>
	</section>
</div>

{#if !done}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3">
			<Button variant={r.blockers.length ? 'primary' : 'ok'} size="lg" class="w-full" onclick={startClose}><Lock class="size-5" />Zakończ przyjęcie</Button>
		</div>
	</div>
{/if}

{#if editing}
	{#key editing.id}
		<ReceiptLineSheet bind:open={lineOpen} line={editing} {busy} onSave={saveLine} />
	{/key}
{/if}

<!-- podsumowanie przed zamknięciem -->
<Sheet bind:open={closeOpen} title="Zakończyć przyjęcie?" description="{r.number} · przyjęto {r.totals.received} z {r.totals.expected} szt.">
	{#if r.blockers.length}
		<p class="mb-2 text-sm font-bold text-bad">Najpierw uzupełnij:</p>
		<ul class="flex flex-col gap-2">
			{#each r.blockers as b (b)}<li class="flex gap-3 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><CircleAlert class="size-5 shrink-0" />{b}</li>{/each}
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
			<p class="mt-3 text-xs text-muted">Brakujące ilości zostają na zamówieniu zakupu – można je przyjąć kolejną PZ (np. z drugiego auta).</p>
		{:else}
			<p class="flex items-center gap-2 rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok"><Check class="size-5" />Wszystkie pozycje zgodne z zamówieniem</p>
		{/if}
		<p class="mt-3 text-sm text-muted">Po zamknięciu towar trafi na miejsce odstawcze <b class="text-ink">{r.dock.stagingLocation}</b>, a Impuls wygeneruje zlecenie magazynowe MWS (alokacja).</p>
	{/if}
	{#snippet footer()}
		{#if !r.blockers.length}
			{#if r.discrepancies.length}
				<Button variant="primary" size="lg" onclick={() => ((closeOpen = false), (approvalOpen = true))}><ShieldCheck class="size-5" />Potwierdź z przełożonym</Button>
				{#if r.status !== 'AWAITING_APPROVAL'}<Button loading={busy} onclick={sendToApproval}><Send class="size-4" />Przełożonego nie ma – wyślij do akceptacji</Button>{/if}
			{:else}
				<Button variant="ok" size="lg" onclick={() => finish()}><Lock class="size-5" />Zakończ i generuj zlecenie MWS</Button>
			{/if}
		{/if}
		<Button variant="ghost" onclick={() => (closeOpen = false)}>Wróć do przyjmowania</Button>
	{/snippet}
</Sheet>

<SupervisorSheet bind:open={approvalOpen} title="Zatwierdzenie rozbieżności" description="{r.number} · {r.supplier.name}" onConfirm={approve}>
	<ul class="divide-y divide-line rounded-xl border border-line text-sm">
		{#each r.discrepancies as d (d.lineId)}
			<li class="flex items-start justify-between gap-3 px-3 py-2">
				<span class="min-w-0"><b class="block truncate">{d.product.name}</b>{#if d.note}<span class="text-xs text-muted">„{d.note}”</span>{/if}</span>
				<span class="font-mono font-bold whitespace-nowrap text-warn">{fmtDiff(d.diff)}</span>
			</li>
		{/each}
	</ul>
</SupervisorSheet>

<GoodsLabelsSheet bind:open={labelsOpen} {labels} printer={data.context.operator.printer} />

<!-- Impuls: generowanie zlecenia MWS -->
{#if phase !== 'idle'}
	<div class="fixed inset-0 z-[55] mx-auto flex max-w-md flex-col bg-ink text-white">
		{#if phase === 'generating'}
			<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
				<LoaderCircle class="size-14 animate-spin text-task" />
				<p class="text-xl font-extrabold">Zamykam {r.number}</p>
				<p class="text-white/70">Impuls generuje zlecenie magazynowe MWS…</p>
			</div>
		{:else if result}
			<div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
				<span class="grid size-20 place-items-center rounded-full bg-ok"><Check class="size-11" strokeWidth={3} /></span>
				<p class="mt-2 text-2xl font-extrabold">Przyjęcie zakończone</p>
				<p class="text-white/70">{r.number} zrealizowana. Towar leży na <b class="text-white">{r.dock.stagingLocation}</b>.</p>
				<div class="mt-3 rounded-2xl bg-white/10 px-5 py-3">
					<p class="text-xs tracking-wide text-white/60 uppercase">Zlecenie magazynowe MWS</p>
					<p class="font-mono text-2xl font-extrabold text-task">{result.number}</p>
				</div>
			</div>
			<div class="pb-safe flex flex-col gap-2 p-4">
				<Button variant="task" size="xl" onclick={() => afterSuccess(`/alokacja/${result!.allocationOrderId}`)}><ArrowDownToLine class="size-6" />Rozpocznij alokację</Button>
				<Button size="lg" onclick={() => afterSuccess(`/dostawy/pz/${r.id}`).then(printLabels)}><Printer class="size-5" />Drukuj etykiety</Button>
				<Button variant="ghost" class="text-white hover:bg-white/10" onclick={() => afterSuccess('/dostawy/do-przyjecia')}>Wróć do dostaw</Button>
			</div>
		{/if}
	</div>
{/if}
