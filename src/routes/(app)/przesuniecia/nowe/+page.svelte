<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { ApiError, createTransfer, getLocationStock, sampleFreeLocations, sampleLocations, type NewTransferLine } from '$lib/api';
	import type { LocationStockDTO, Product, StockRowDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Save from '@lucide/svelte/icons/save';
	import Play from '@lucide/svelte/icons/play';
	import Send from '@lucide/svelte/icons/send';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { data } = $props();
	let refs = $derived(data.context.refs);

	let warehouseId = $state(untrack(() => data.warehouseId) ?? 'mg01');
	let reason = $state('');
	let lines = $state<(NewTransferLine & { product: Product })[]>([]);
	let busy = $state(false);

	// Makieta: przykładowe lokalizacje do "symuluj skan" – pobierane z danych mockowych przez API
	let sampleFrom = $state<string[]>([]);
	$effect(() => {
		sampleLocations(warehouseId).then((l) => (sampleFrom = l));
	});

	const REASONS = ['Uzupełnienie strefy kompletacji', 'Konsolidacja – zwolnienie miejsca', 'Towar uszkodzony – kwarantanna', 'Reorganizacja regału'];

	// --- dodawanie pozycji: skan półki -> wybór produktu -> ilość -> cel ---
	let addOpen = $state(false);
	let stock = $state<LocationStockDTO | null>(null);
	let row = $state<StockRowDTO | null>(null);
	let qty = $state(1);
	let to = $state<string | null>(null);
	let sampleTo = $state<string[]>([]);

	function openAdd() {
		stock = null;
		row = null;
		to = null;
		addOpen = true;
	}

	async function onFrom(code: string): Promise<string | null> {
		try {
			stock = await getLocationStock(warehouseId, code);
			if (!stock.items.length) return `Lokalizacja ${code} jest pusta`;
			if (stock.items.length === 1) pick(stock.items[0]);
			return null;
		} catch (e) {
			return e instanceof ApiError ? e.message : String(e);
		}
	}

	async function pick(r: StockRowDTO) {
		row = r;
		qty = r.qty;
		sampleTo = await sampleFreeLocations(warehouseId, r.location);
	}

	function onTo(code: string): string | null {
		if (row && code === row.location) return 'Cel musi być inny niż lokalizacja źródłowa';
		to = code;
		return null;
	}

	function addLine() {
		if (!row) return;
		lines.push({ productId: row.productId, product: row.product, fromLocation: row.location, batch: row.batch, qty, toLocation: to });
		addOpen = false;
	}

	async function save(submit: boolean, execute = false) {
		busy = true;
		try {
			let { id, number } = await createTransfer({ warehouseId, reason, lines: lines.map(({ product: _, ...l }) => l), submit });
			toast.ok(`Utworzono ${number}`, submit ? 'Dokument trafił do realizacji' : 'Zapisano jako szkic');
			await goto(execute || !submit ? `/przesuniecia/${id}` : '/przesuniecia');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

<PageHeader title="Nowe przesunięcie" subtitle="MM w obrębie magazynu" back="/przesuniecia" />

<div class="flex flex-col gap-3 p-3 pb-44">
	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<p class="text-sm font-bold">Magazyn</p>
		<div class="mt-2 grid grid-cols-2 gap-2">
			{#each refs.warehouses as w (w.id)}
				<button type="button" disabled={lines.length > 0} class="rounded-xl border-2 p-3 text-left disabled:opacity-50 {warehouseId === w.id ? 'border-ink bg-task-soft' : 'border-line'}" onclick={() => (warehouseId = w.id)}>
					<b class="block">{w.code}</b><span class="text-xs text-muted">{w.name}</span>
				</button>
			{/each}
		</div>
		<label class="mt-4 block text-sm font-bold">
			Powód
			<input bind:value={reason} class="mt-1 h-12 w-full rounded-xl border-2 border-line-strong px-3 font-normal outline-none focus:border-ink" placeholder="np. uzupełnienie strefy kompletacji" />
		</label>
		<div class="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
			{#each REASONS as r (r)}<button type="button" class="h-8 shrink-0 rounded-full bg-bg px-3 text-xs font-semibold" onclick={() => (reason = r)}>{r}</button>{/each}
		</div>
	</section>

	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Pozycje ({lines.length})</h2>
		{#if lines.length}
			<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
				{#each lines as l, i (i)}
					<li class="flex items-start gap-3 border-t border-line p-3 first:border-0">
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{l.product.name}</p>
							<p class="flex items-center gap-1 font-mono text-xs text-muted">{l.fromLocation}<ArrowRight class="size-3" />{l.toLocation ?? 'dowolna'}{l.batch ? ` · ${l.batch}` : ''}</p>
						</div>
						<span class="font-mono font-bold">{l.qty} {l.product.unit}</span>
						<button type="button" class="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Usuń" onclick={() => lines.splice(i, 1)}><X class="size-4" /></button>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty>Dodaj towar do przesunięcia – zacznij od zeskanowania półki</Empty>
		{/if}
		<Button size="lg" class="mt-2 w-full" onclick={openAdd}><Plus class="size-5" />Dodaj pozycję</Button>
	</section>
</div>

<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
	<div class="flex flex-col gap-2 pb-3">
		<Button variant="task" size="lg" disabled={!lines.length} loading={busy} onclick={() => save(true, true)}><Play class="size-5" />Zatwierdź i realizuj teraz</Button>
		<div class="grid grid-cols-2 gap-2">
			<Button disabled={!lines.length || busy} onclick={() => save(true)}><Send class="size-4" />Do realizacji</Button>
			<Button disabled={!lines.length || busy} onclick={() => save(false)}><Save class="size-4" />Zapisz szkic</Button>
		</div>
	</div>
</div>

<Sheet bind:open={addOpen} title="Dodaj pozycję" description={stock ? `Lokalizacja ${stock.location.code}` : 'Zeskanuj lokalizację źródłową'} tall>
	{#if !stock}
		<ScanInput placeholder="Kod lokalizacji źródłowej" onScan={onFrom} hints={sampleFrom.map((c) => ({ code: c }))} />
	{:else if !row}
		<p class="mb-2 text-sm font-bold">Co przesuwasz?</p>
		<ul class="flex flex-col gap-2">
			{#each stock.items as s (s.id)}
				<li>
					<button type="button" class="flex w-full items-center gap-3 rounded-2xl border-2 border-line p-3 text-left active:border-ink" onclick={() => pick(s)}>
						<span class="min-w-0 flex-1">
							<b class="block truncate">{s.product.name}</b>
							<span class="font-mono text-xs text-muted">{s.product.sku}{s.batch ? ` · ${s.batch}` : ''}{s.expiry ? ` · do ${fmtDate(s.expiry)}` : ''}</span>
						</span>
						<span class="font-mono font-bold">{s.qty} {s.product.unit}</span>
					</button>
				</li>
			{/each}
		</ul>
		<Button variant="ghost" class="mt-2 w-full" onclick={() => (stock = null)}>Inna lokalizacja</Button>
	{:else}
		<div class="rounded-2xl bg-bg p-3">
			<p class="font-bold">{row.product.name}</p>
			<p class="font-mono text-xs text-muted">{row.product.sku}{row.batch ? ` · seria ${row.batch}` : ''} · na półce {row.qty}</p>
			<div class="mt-1.5 flex gap-1.5"><ProductFlags product={row.product} size="sm" /></div>
		</div>
		<p class="mt-4 mb-1.5 text-sm font-bold">Ilość</p>
		<QtyStepper bind:value={qty} min={1} max={row.qty} unit={row.product.unit} size="lg" />
		<p class="mt-4 mb-1.5 text-sm font-bold">Lokalizacja docelowa <span class="font-normal text-muted">(opcjonalnie)</span></p>
		{#if to}
			<div class="flex items-center gap-2 rounded-xl bg-task-soft p-3"><MapPin class="size-5" /><b class="flex-1 font-mono text-lg">{to}</b><Button size="sm" variant="ghost" onclick={() => (to = null)}>Zmień</Button></div>
		{:else}
			<ScanInput placeholder="Kod lokalizacji docelowej" onScan={onTo} hints={sampleTo.map((c) => ({ code: c }))} autofocus={false} />
			<p class="mt-1 text-xs text-muted">Bez celu – magazynier wskaże lokalizację przy realizacji.</p>
		{/if}
	{/if}
	{#snippet footer()}
		{#if row}<Button variant="task" size="lg" onclick={addLine}><Plus class="size-5" />Dodaj do MM</Button>{/if}
	{/snippet}
</Sheet>
