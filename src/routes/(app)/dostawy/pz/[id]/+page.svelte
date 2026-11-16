<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, closeReceipt, generateMwsOrder, printReceiptLabels, requestApproval, setReceiptCarriers, verifySupervisorPin } from '$lib/api';
	import type { GoodsLabelDTO, ReceiptLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate, fmtDiff, plural } from '$lib/format';
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
	let done = $derived(r.status === 'DONE');
	let busy = $state(false);

	// --- korekta serii (tylko PZ po rozładunku, pozycje z seriami) ---
	let correctingId = $state<string | null>(null);
	let correctOpen = $state(false);
	let correcting = $derived(r.lines.find((l) => l.id === correctingId) ?? null);

	function openLine(l: ReceiptLineDTO) {
		if (!done || !l.batches.length) return;
		correctingId = l.id;
		correctOpen = true;
	}

	// --- rozładunek: liczba przyjętych nośników (jedyne dane od magazyniera) ---
	let carriers = $state(untrack(() => r.carriers.received ?? r.carriers.advised ?? 1));
	let carriersDirty = $derived(carriers !== r.carriers.received);

	async function saveCarriers() {
		busy = true;
		try {
			await setReceiptCarriers(r.id, carriers);
			toast.ok(`Zapisano: ${carriers} ${plural(carriers, 'nośnik', 'nośniki', 'nośników')}`);
			await invalidateAll();
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
<PageHeader title={done ? r.number : r.advice.number} titleNote={done ? STATUS[r.statusKey]?.[0] : r.status === 'AWAITING_APPROVAL' ? 'Czeka na akceptację' : 'Rozładunek'} subtitle={r.supplier.name} back={!done ? '/dostawy/do-przyjecia' : r.statusKey === 'PZ_DONE' ? '/dostawy/przyjete' : '/dostawy/w-trakcie'} />

<div class="flex flex-col gap-3 p-3 {done ? '' : 'pb-28'}">
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
			<p class="mt-1 text-sm">Nośniki: przyjęto {r.carriers.received}, awizowano {r.carriers.advised} · {r.pendingMws === false ? 'bez zlecenia MWS' : 'ze zleceniem MWS'}</p>
			{#if isSupervisor}
				<Button variant="primary" class="mt-3 w-full" onclick={approvePending}><ShieldCheck class="size-4" />Zatwierdź rozbieżności</Button>
			{/if}
		</section>
	{/if}

	{#if !done}<ReceiptDocuments receiptId={r.id} number={r.advice.number} documents={r.documents} />{/if}

	{#if done}
		<!-- po rozładunku: zlecenie MWS, alokacja, etykiety -->
		{#if r.mwsSkipped}
			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<p class="text-xs font-bold tracking-wide text-muted uppercase">Zlecenie magazynowe MWS</p>
				<p class="mt-1 flex items-center gap-2 font-bold"><Ban class="size-5 text-muted" />Nie wygenerowano</p>
				<p class="mt-0.5 text-sm text-muted">Rozładunek zakończony bez zlecenia – towar leży na <b class="text-ink">{r.dock.stagingLocation}</b> i nie trafi do Alokacji.</p>
				<div class="mt-3 grid grid-cols-2 gap-2">
					<Button loading={busy} onclick={printLabels}><Printer class="size-4" />Etykiety</Button>
					<Button variant="task" onclick={generateLater}><ArrowDownToLine class="size-4" />Generuj ZM</Button>
				</div>
			</section>
		{:else if r.allocation}
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
			<div class="flex items-center justify-between gap-2">
				<p class="flex items-center gap-2 text-sm font-bold"><Layers class="size-4 text-muted" />Przyjęte nośniki</p>
				<span class="text-xs text-muted">{r.carriers.advised !== null ? `awizowano: ${r.carriers.advised}` : 'awizacja bez liczby palet'}</span>
			</div>
			<div class="mt-3 flex gap-2">
				<QtyStepper bind:value={carriers} min={0} max={999} unit="szt." size="lg" class="flex-1" />
				<Button variant="primary" size="lg" class="h-14" disabled={!carriersDirty} loading={busy} onclick={saveCarriers}>Zapisz</Button>
			</div>
			{#if r.carriers.received === null}
				<p class="mt-2 text-xs text-muted">Policz palety / nośniki zdjęte z auta i zapisz.</p>
			{:else if r.carriers.diff}
				<p class="mt-2 flex gap-2 rounded-xl bg-warn-soft p-2.5 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Różnica {fmtDiff(r.carriers.diff)} względem awizacji – zakończenie wymaga potwierdzenia przełożonego.</p>
			{:else if !carriersDirty}
				<p class="mt-2 flex items-center gap-1.5 text-xs font-bold text-ok"><Check class="size-4" />Zapisano{r.carriers.advised !== null ? ' – zgodne z awizacją' : ''}</p>
			{/if}
		</section>
	{/if}

	<!-- pozycje -->
	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Pozycje ({r.lines.length})</h2>
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each r.lines as l (l.id)}
				{@const editable = done && l.batches.length > 0}
				<li class="border-t border-line first:border-0">
					<svelte:element this={editable ? 'button' : 'div'} type={editable ? 'button' : undefined} role={editable ? undefined : 'listitem'} class="flex w-full items-start gap-3 p-3 text-left {editable ? 'active:bg-bg' : ''}" onclick={editable ? () => openLine(l) : undefined}>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{l.product.name}</span>
							<span class="block font-mono text-xs text-muted">{l.product.sku} · {l.purchaseOrderNumber}</span>
							<span class="mt-1 flex flex-wrap gap-1"><ProductFlags product={l.product} size="sm" /></span>
							{#if l.batches.length}<span class="mt-1 block text-xs text-info">Seria: {l.batches.map((b) => `${b.batch} (${b.qty})`).join(', ')}</span>{/if}
							{#if l.batchCorrections?.length}<span class="mt-0.5 block text-xs text-muted">Poprawiono serię ({l.batchCorrections.length}×), ostatnio {l.batchCorrections.at(-1)!.by}</span>{/if}
							{#if editable}<span class="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink-2 underline underline-offset-2"><Pencil class="size-3" />Popraw serię</span>{/if}
							{#if l.serials.length}<span class="mt-1 block text-xs text-ink-2">SN: {l.serials.join(', ')}</span>{/if}
							{#if l.note}<span class="mt-1 block text-xs text-warn">„{l.note}”</span>{/if}
						</span>
						<span class="text-right font-mono font-extrabold whitespace-nowrap">
							{#if done && l.diff !== 0}{l.receivedQty}<span class="text-muted">/{l.expectedQty}</span><span class="block text-xs font-bold text-warn">{fmtDiff(l.diff)}</span>
							{:else}{l.expectedQty} <span class="text-sm font-normal text-muted">{l.product.unit}</span>{/if}
						</span>
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
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="flex items-center gap-2 text-muted"><Layers class="size-4" />Nośniki przyjęte</dt><dd class="font-bold">{r.carriers.received ?? '—'}{r.carriers.advised !== null ? ` / awizowano ${r.carriers.advised}` : ''}</dd></div>
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="flex items-center gap-2 text-muted"><FileText class="size-4" />Dokumenty</dt><dd class="font-bold {r.documents.length ? '' : 'text-warn'}">{r.documents.length ? `${r.documents.length} zdj.` : 'brak zdjęć'}</dd></div>
		<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Pozycje z dokumentu</dt><dd class="font-bold">{r.lines.length}</dd></div>
	</dl>
	{#if r.needsApproval}
		<p class="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Różnica nośników {fmtDiff(r.carriers.diff ?? 0)} – po wyborze potrzebny PIN przełożonego.</p>
	{/if}
	<p class="mt-3 text-sm text-muted">Towar trafi na miejsce odstawcze <b class="text-ink">{r.dock.stagingLocation}</b>, a PZ będzie do realizacji. Zlecenie MWS (alokacja) można też wygenerować później.</p>
	{#snippet footer()}
		<Button variant="ok" size="lg" onclick={() => choose(true)}><ArrowDownToLine class="size-5" />Zamknij z generowaniem MWS</Button>
		<Button size="lg" onclick={() => choose(false)}><Ban class="size-5" />Zamknij bez generowania MWS</Button>
		<Button variant="ghost" size="lg" onclick={() => (closeOpen = false)}>Wróć</Button>
	{/snippet}
</Sheet>

<SupervisorSheet bind:open={approvalOpen} title="Zatwierdzenie różnicy nośników" description="{r.advice.number} · {generateMws ? 'ze zleceniem MWS' : 'bez zlecenia MWS'}" onConfirm={approve}>
	<p class="rounded-xl border border-line px-3 py-2.5 text-sm">Przyjęto <b>{r.carriers.received}</b> {plural(r.carriers.received ?? 0, 'nośnik', 'nośniki', 'nośników')}, awizowano <b>{r.carriers.advised}</b> <span class="font-mono font-bold text-warn">({fmtDiff(r.carriers.diff ?? 0)})</span></p>
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
				<p class="text-white/70">{r.number} – do realizacji. Towar leży na <b class="text-white">{r.dock.stagingLocation}</b>.</p>
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
				{#if result.allocationOrderId}
					<Button variant="task" size="xl" onclick={() => afterSuccess(`/alokacja/${result!.allocationOrderId}`)}><ArrowDownToLine class="size-6" />Rozpocznij alokację</Button>
				{/if}
				<Button size="lg" onclick={() => afterSuccess(`/dostawy/pz/${r.id}`).then(printLabels)}><Printer class="size-5" />Drukuj etykiety</Button>
				<Button variant="ghost" class="text-white hover:bg-white/10" onclick={() => afterSuccess('/dostawy/do-przyjecia')}>Wróć do dostaw</Button>
			</div>
		{/if}
	</div>
{/if}
