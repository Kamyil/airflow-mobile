<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError, confirmPickingOrder, deferLine, packLine, printLabels } from '$lib/api';
	import type { CarrierDTO, LabelDTO, PickingOrderDetailDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDay, fmtKg, plural } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import LabelStateBadge from '$lib/components/LabelStateBadge.svelte';
	import LabelsSheet from '$lib/components/LabelsSheet.svelte';
	import AddCarrierSheet from './AddCarrierSheet.svelte';
	import ScanWizard from './ScanWizard.svelte';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';

	let { data } = $props();
	let po: PickingOrderDetailDTO = $derived(data.po);
	let current = $derived(po.current);
	let readonly = $derived(po.released);
	let printer = $derived(data.context.operator.printer);
	let unlabeled = $derived(po.carriers.filter((c) => !c.hasLabel));

	let busy = $state(false);

	// --- zakładki: Zadanie (tylko to, co teraz) / Nośniki / Lista ---
	type Tab = 'zadanie' | 'nosniki' | 'lista';
	let tab = $derived((page.url.searchParams.get('tab') as Tab) ?? 'zadanie');
	let tabs = $derived([
		{ id: 'zadanie' as Tab, label: 'Zadanie', count: null, alert: false },
		{ id: 'nosniki' as Tab, label: 'Nośniki', count: po.carriers.length, alert: unlabeled.length > 0 },
		{ id: 'lista' as Tab, label: 'Lista', count: po.progress.lines, alert: false }
	]);
	function setTab(t: Tab) {
		goto(t === 'zadanie' ? '?' : `?tab=${t}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	// --- sheety ---
	let infoOpen = $state(false);
	let addOpen = $state(false);
	let labels: LabelDTO[] = $state([]);
	let labelsOpen = $state(false);
	let confirmOpen = $state(false);

	/** Bramka etykiety: pakowanie na nośnik / edycja nośnika bez etykiety wymaga jej wydruku */
	let gate = $state<{ carrier: CarrierDTO; then: () => Promise<void> } | null>(null);
	let gateOpen = $state(false);

	async function run(fn: () => Promise<void>) {
		busy = true;
		try {
			await fn();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	/** Wywoływane przez ostatni krok skanowania. Zwraca komunikat błędu do pokazania przy polu. */
	async function pack(carrierCode: string, qty: number): Promise<string | null> {
		if (!current) return null;
		let line = current;
		let carrier = po.carriers.find((c) => c.code === carrierCode);
		if (carrier && !carrier.hasLabel) {
			let target = carrier;
			gate = { carrier: target, then: () => doPack(line.id, target.code, qty) };
			gateOpen = true;
			return null;
		}
		busy = true;
		try {
			await doPack(line.id, carrierCode, qty);
			return null;
		} catch (e) {
			if (e instanceof ApiError) return e.message;
			toast.error(e);
			return null;
		} finally {
			busy = false;
		}
	}

	async function doPack(lineId: string, carrierCode: string, qty: number) {
		let line = po.lines.find((l) => l.id === lineId)!;
		await packLine({ pickingOrderId: po.id, lineId, carrierCode, qty });
		toast.ok(`Spakowano ${qty} ${line.product.unit} → ${carrierCode}`, line.product.name);
		await invalidateAll();
	}

	function skip() {
		if (!current) return;
		let line = current;
		run(async () => {
			await deferLine(po.id, line.id);
			toast.info('Pozycja przeniesiona na koniec kolejki', `${line.location} · ${line.product.name}`);
			await invalidateAll();
		});
	}

	function openCarrier(c: CarrierDTO) {
		let go = () => goto(`/kompletacja/${po.id}/nosnik/${c.id}`);
		if (!c.hasLabel && !readonly) {
			gate = { carrier: c, then: go };
			gateOpen = true;
			return;
		}
		go();
	}

	function passGate() {
		if (!gate) return;
		let { carrier, then } = gate;
		run(async () => {
			await printLabels([carrier.id], { withContent: false });
			toast.ok(`Wydrukowano etykietę ${carrier.code}`, 'Naklej ją na nośnik.');
			gateOpen = false;
			await then();
		});
	}

	function printMissing() {
		run(async () => {
			let ids = unlabeled.map((c) => c.id);
			await printLabels(ids, { withContent: false });
			toast.ok(`Wydrukowano ${ids.length} ${plural(ids.length, 'etykietę', 'etykiety', 'etykiet')}`, 'Naklej je na nośniki.');
			await invalidateAll();
		});
	}

	function printCarriers(ids: string[]) {
		run(async () => {
			labels = await printLabels(ids, { withContent: true });
			labelsOpen = true;
			await invalidateAll();
		});
	}

	// --- zatwierdzenie ---
	let contentToPrint = $derived(po.carriers.filter((c) => c.totalQty > 0 && (c.contentLabelMissing || c.contentLabelOutdated)));
	let emptyCarriers = $derived(po.carriers.filter((c) => c.totalQty === 0));

	function confirmAndClose(withPrint: boolean) {
		run(async () => {
			if (withPrint && contentToPrint.length) {
				await printLabels(
					contentToPrint.map((c) => c.id),
					{ withContent: true }
				);
			}
			await confirmPickingOrder(po.id);
			confirmOpen = false;
			toast.ok(`Zamknięto ${po.number}`, po.queue.length ? `Zostało do spakowania: ${po.queue.length} poz.` : 'Wszystko spakowane – można wydać.');
			await goto('/kompletacja');
		});
	}
</script>

<PageHeader title={po.salesOrder.number} subtitle={po.customer.name} back="/kompletacja">
	{#snippet actions()}
		<button type="button" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Szczegóły zlecenia" onclick={() => (infoOpen = true)}>
			<Info class="size-6" />
		</button>
		{#if !readonly}
			<button type="button" class="mr-1 h-9 rounded-full border border-white/30 px-3 text-sm font-bold hover:bg-white/10" onclick={() => (confirmOpen = true)}>Zakończ</button>
		{/if}
	{/snippet}
	{#snippet below()}
		<nav class="grid grid-cols-3 px-2">
			{#each tabs as t}
				<button type="button" class="relative flex h-11 items-center justify-center gap-1.5 text-sm font-bold {tab === t.id ? 'text-white' : 'text-white/55'}" onclick={() => setTab(t.id)}>
					{t.label}
					{#if t.count !== null}
						<span class="rounded-full px-1.5 text-xs {t.alert ? 'bg-bad text-white' : 'bg-white/15'}">{t.count}</span>
					{/if}
					{#if tab === t.id}<span class="absolute inset-x-4 bottom-0 h-[3px] rounded-t-full bg-task"></span>{/if}
				</button>
			{/each}
		</nav>
	{/snippet}
</PageHeader>

{#if tab === 'zadanie'}
	<main class="flex flex-1 flex-col gap-4 px-4 pt-4 {!current && !readonly ? 'pb-28' : 'pb-8'}">
		{#if readonly}
			<div class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
				<Lock class="size-10" />
				<p class="font-bold text-ink">Zlecenie wydane</p>
				<p class="text-sm">Aby coś zmienić, cofnij wydanie w widoku Wysyłka.</p>
			</div>
		{:else if current}
			<div class="flex items-center justify-between">
				<p class="text-sm font-bold text-muted">
					Pozycja <span class="text-ink">{current.seq}</span> z {po.progress.lines}
					{#if current.deferred}<Badge tone="warn" class="ml-1 h-5 text-[10px]">pominięta</Badge>{/if}
				</p>
				<button type="button" class="-mr-2 flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-ink/5 disabled:opacity-30" disabled={busy || po.queue.length < 2} onclick={skip}>
					Pomiń<SkipForward class="size-4" />
				</button>
			</div>

			<!-- gdzie iść, co wziąć, ile -->
			<section class="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-line">
				<div class="flex items-end justify-between gap-3 bg-task px-5 pt-4 pb-5 text-task-ink">
					<div class="min-w-0">
						<p class="text-xs font-bold uppercase opacity-70">Lokalizacja</p>
						<p class="flex items-center gap-1.5 font-mono text-4xl leading-none font-extrabold tracking-tight">
							<MapPin class="size-7 shrink-0" strokeWidth={2.6} />{current.location}
						</p>
					</div>
					<div class="text-right">
						<p class="text-xs font-bold uppercase opacity-70">Weź</p>
						<p class="font-mono text-4xl leading-none font-extrabold tabular-nums">{current.remainingQty}<span class="ml-1 text-base">{current.product.unit}</span></p>
					</div>
				</div>
				<div class="px-5 py-4">
					<p class="text-xl leading-snug font-extrabold">{current.product.name}</p>
					<p class="mt-1 font-mono text-xs text-muted">{current.product.sku} · {current.product.ean}</p>
					{#if current.packedOn.length}
						<div class="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-sm">
							<p class="font-bold text-ok">Już spakowano {current.packedQty} z {current.qty}</p>
							{#each current.packedOn as p}
								<p class="flex items-center justify-between gap-2"><CarrierCode code={p.carrierCode} /><b class="font-mono">{p.qty} {current.product.unit}</b></p>
							{/each}
						</div>
					{/if}
				</div>
			</section>

			<ScanWizard line={current} carriers={po.carriers} {busy} onPack={pack} onAddCarrier={() => (addOpen = true)} />
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
				<CircleCheckBig class="size-14 text-ok" />
				<p class="text-xl font-extrabold">Wszystko spakowane</p>
				<p class="text-sm text-muted">Zamknij kompletację – wydrukujesz przy tym etykiety z zawartością.</p>
			</div>
		{/if}
	</main>

	{#if !current && !readonly}
		<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface px-3 pt-3">
			<div class="pb-3">
				<Button variant="ok" size="xl" class="w-full" onclick={() => (confirmOpen = true)}><CircleCheckBig class="size-6" />Zatwierdź i zamknij</Button>
			</div>
		</div>
	{/if}
{:else if tab === 'nosniki'}
	<main class="flex flex-col gap-3 px-3 pt-3 pb-8">
		{#if unlabeled.length && !readonly}
			<div class="flex items-center gap-3 rounded-2xl bg-bad-soft p-3">
				<p class="flex-1 text-sm font-semibold text-bad">{unlabeled.length} {plural(unlabeled.length, 'nośnik', 'nośniki', 'nośników')} bez etykiety</p>
				<Button size="sm" variant="primary" disabled={busy} onclick={printMissing}><Printer class="size-4" />Drukuj</Button>
			</div>
		{/if}
		<ul class="flex flex-col gap-2">
			{#each po.carriers as c (c.id)}
				<li class="flex items-stretch overflow-hidden rounded-2xl border border-line bg-surface">
					<button type="button" class="flex min-w-0 flex-1 items-center gap-3 p-3 text-left active:bg-bg" onclick={() => openCarrier(c)}>
						<span class="grid size-11 shrink-0 place-items-center rounded-xl bg-bg"><CarrierIcon kind={c.kind} /></span>
						<span class="min-w-0 flex-1">
							<CarrierCode code={c.code} class="block text-[17px]" />
							<span class="block text-xs text-muted">{c.name} · {c.items.length} poz. · {fmtKg(c.weightKg)}</span>
							{#if !c.hasLabel || c.contentLabelOutdated}<span class="mt-1 block"><LabelStateBadge carrier={c} /></span>{/if}
						</span>
						<ChevronRight class="size-5 shrink-0 text-muted" />
					</button>
					<button type="button" class="grid w-14 shrink-0 place-items-center border-l border-line text-ink-2 hover:bg-bg" aria-label="Drukuj etykietę {c.code}" onclick={() => printCarriers([c.id])}>
						<Printer class="size-5" />
					</button>
				</li>
			{:else}
				<li class="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-muted">Brak nośników</li>
			{/each}
		</ul>
		{#if !readonly}
			<button type="button" class="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong font-bold text-ink-2" onclick={() => (addOpen = true)}>
				<Plus class="size-5" />Dodaj nośnik
			</button>
		{/if}
		{#if po.carriers.length > 1}
			<Button variant="ghost" disabled={busy} onclick={() => printCarriers(po.carriers.map((c) => c.id))}><Printer class="size-4" />Drukuj etykiety wszystkich nośników</Button>
		{/if}
	</main>
{:else}
	<!-- Lista: kolejność z ERP, spakowane na zielono (kolejność się nie zmienia) -->
	<main class="px-3 pt-3 pb-8">
		<ol class="overflow-hidden rounded-2xl border border-line bg-surface">
			{#each po.lines as line (line.id)}
				{@const packed = line.remainingQty === 0}
				{@const isCurrent = line.id === current?.id && !readonly}
				<li class="flex gap-3 border-t border-line px-3 py-3 first:border-0 {packed ? 'bg-ok-soft' : isCurrent ? 'bg-task-soft' : ''}">
					<span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold {packed ? 'bg-ok text-white' : isCurrent ? 'bg-task text-task-ink' : 'bg-bg text-muted'}">
						{#if packed}<Check class="size-4" strokeWidth={3} />{:else}{line.seq}{/if}
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<p class="font-mono text-sm font-extrabold">{line.location}</p>
							<p class="font-mono text-sm font-bold whitespace-nowrap">
								{#if line.packedQty > 0 && !packed}<span class="text-ok">{line.packedQty}</span>/{/if}{line.qty}
								<span class="text-xs font-normal text-muted">{line.product.unit}</span>
							</p>
						</div>
						<p class="text-sm text-ink-2">
							{line.product.name}
							{#if line.deferred && !packed}<Badge tone="warn" class="ml-1 h-5 px-1.5 text-[10px]">pominięta</Badge>{/if}
						</p>
						{#each line.packedOn as p}
							<p class="mt-1 flex items-center gap-1.5 text-xs text-ok">
								<Check class="size-3.5" strokeWidth={3} />
								<CarrierCode code={p.carrierCode} class="text-ink" />
								<b class="ml-auto font-mono">{p.qty} {line.product.unit}</b>
							</p>
						{/each}
					</div>
				</li>
			{/each}
		</ol>
	</main>
{/if}

<Sheet bind:open={infoOpen} title={po.number} description={po.customer.name}>
	<dl class="divide-y divide-line rounded-xl border border-line text-sm">
		<div class="flex justify-between gap-4 px-4 py-2.5"><dt class="text-muted">Zamówienie</dt><dd class="font-mono font-bold">{po.salesOrder.number}</dd></div>
		<div class="flex justify-between gap-4 px-4 py-2.5"><dt class="text-muted">Zam. klienta</dt><dd class="font-mono">{po.salesOrder.customerOrderNumber}</dd></div>
		<div class="flex justify-between gap-4 px-4 py-2.5"><dt class="text-muted">Odbiorca</dt><dd class="text-right">{po.customer.street}, {po.customer.city}</dd></div>
		<div class="flex justify-between gap-4 px-4 py-2.5">
			<dt class="text-muted">Spedytor</dt>
			<dd class="text-right font-bold">
				{#if po.forwarder}
					<span class="flex items-center gap-1"><CarrierIcon kind={po.forwarder.kind} class="size-4" />{po.forwarder.name}</span>
				{:else}
					<span class="font-normal text-muted">po dodaniu nośnika</span>
				{/if}
			</dd>
		</div>
		<div class="flex justify-between gap-4 px-4 py-2.5"><dt class="text-muted">Termin</dt><dd class="font-bold">{fmtDay(po.salesOrder.shipDate)} ({po.salesOrder.shipDate})</dd></div>
		<div class="flex justify-between gap-4 px-4 py-2.5"><dt class="text-muted">Postęp</dt><dd class="font-bold">{po.progress.linesDone}/{po.progress.lines} poz.</dd></div>
	</dl>
</Sheet>

<AddCarrierSheet
	bind:open={addOpen}
	pickingOrderId={po.id}
	lockedKind={po.carrierKind}
	carrierTypes={po.carrierTypes}
	forwarders={po.forwarders}
	onCreated={async () => {
		await invalidateAll();
	}}
/>

<LabelsSheet bind:open={labelsOpen} {labels} {printer} />

<Sheet bind:open={gateOpen} title="Nośnik nie ma etykiety" description="Wydrukuj etykietę i naklej ją na nośnik, zanim cokolwiek na nim spakujesz lub go edytujesz.">
	{#if gate}
		<div class="rounded-2xl border border-line p-3">
			<CarrierCode code={gate.carrier.code} class="text-lg" />
			<p class="text-sm text-muted">{gate.carrier.name} · {po.customer.name}</p>
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="primary" size="lg" loading={busy} onclick={passGate}><Printer class="size-5" />Drukuj etykietę i kontynuuj</Button>
		<Button variant="ghost" onclick={() => (gateOpen = false)}>Anuluj</Button>
	{/snippet}
</Sheet>

<Sheet bind:open={confirmOpen} title="Zatwierdzić i zamknąć?" description="{po.number} · {po.customer.name}">
	<div class="flex flex-col gap-2">
		{#if po.queue.length}
			<p class="flex gap-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">
				<TriangleAlert class="size-5 shrink-0" />Zostało do spakowania: {po.queue.length} poz.
			</p>
		{/if}
		{#if emptyCarriers.length}
			<p class="flex gap-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">
				<TriangleAlert class="size-5 shrink-0" />Puste nośniki: {emptyCarriers.length}
			</p>
		{/if}
		<ul class="mt-1 divide-y divide-line rounded-xl border border-line">
			{#each po.carriers as c}
				<li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
					<CarrierCode code={c.code} />
					<span class="text-muted">{c.items.length} poz. · {fmtKg(c.weightKg)}</span>
				</li>
			{/each}
		</ul>
	</div>
	{#snippet footer()}
		{#if contentToPrint.length}
			<Button variant="primary" size="lg" loading={busy} onclick={() => confirmAndClose(true)}><Printer class="size-5" />Drukuj etykiety i zamknij</Button>
			<Button variant="ghost" disabled={busy} onclick={() => confirmAndClose(false)}>Zamknij bez drukowania</Button>
		{:else}
			<Button variant="primary" size="lg" loading={busy} onclick={() => confirmAndClose(false)}><CircleCheckBig class="size-5" />Zatwierdź i zamknij</Button>
		{/if}
	{/snippet}
</Sheet>
