<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getAdvice, startReceipt } from '$lib/api';
	import type { AdviceDetailDTO, AdviceDTO } from '$lib/types';
	import { setParams } from '$lib/url';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate, fmtDay, fmtDayLong, plural } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import DatePickerSheet from '$lib/components/DatePickerSheet.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import WarehouseDockFilters from '../WarehouseDockFilters.svelte';
	import { _DAY_OFFSETS } from './+page';
	import Truck from '@lucide/svelte/icons/truck';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import Layers from '@lucide/svelte/icons/layers';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Phone from '@lucide/svelte/icons/phone';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';

	let { data } = $props();
	let f = $derived(data.filter);

	// wyszukiwarka – zapis do adresu z lekkim opóźnieniem
	let q = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;
	function onSearch(v: string) {
		q = v;
		clearTimeout(timer);
		timer = setTimeout(() => setParams({ q: v.trim() || null }), 250);
	}

	// dni – wybór wielokrotny (co najmniej jeden zawsze zaznaczony)
	const DAY_LABEL: Record<number, string> = { [-1]: 'Wczoraj', 0: 'Dziś', 1: 'Jutro' };
	function toggleDay(n: number) {
		let set = f.offsets.includes(n) ? f.offsets.filter((x) => x !== n) : [...f.offsets, n];
		if (!set.length) return;
		set.sort((a, b) => a - b);
		setParams({ data: null, dni: set.length === 1 && set[0] === 0 ? null : set.join(',') });
	}
	// konkretna data z kalendarza – zastępuje szybki wybór dni
	function pickDate(d: string) {
		if (d) setParams({ data: d, dni: null });
	}
	let calendarOpen = $state(false);
	let multiDay = $derived(f.offsets.length > 1);

	// --- szczegóły awizacji ---
	let detail = $state<AdviceDetailDTO | null>(null);
	let detailOpen = $state(false);
	let busy = $state(false);

	async function open(a: AdviceDTO) {
		// rozładunek w toku – od razu do ekranu rozładunku
		if (a.openReceipt) return goto(`/dostawy/pz/${a.openReceipt.id}`);
		detail = null;
		detailOpen = true;
		try {
			detail = await getAdvice(a.id);
		} catch (e) {
			toast.error(e);
			detailOpen = false;
		}
	}

	async function start() {
		if (!detail) return;
		busy = true;
		try {
			let { receiptId, created } = await startReceipt(detail.id);
			if (created) toast.ok('Rozpoczęto rozładunek', `${detail.supplier.name} · ${detail.dock.name}`);
			detailOpen = false;
			await goto(`/dostawy/pz/${receiptId}`);
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-2.5 px-3 pt-3">
	<div class="flex gap-1.5">
		<div class="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-ink/6 p-1" role="group" aria-label="Dzień dostawy">
			{#each _DAY_OFFSETS as n (n)}
				{@const on = f.offsets.includes(n)}
				<button type="button" aria-pressed={on} class="flex h-10 items-center justify-center gap-1 rounded-lg text-sm font-bold {on ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => toggleDay(n)}>
					{#if on}<Check class="size-4" strokeWidth={3} />{/if}{DAY_LABEL[n]}
				</button>
			{/each}
		</div>
		<button type="button" aria-label="Wybierz datę" class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold {f.date ? 'border-task bg-task text-task-ink' : 'border-line-strong bg-surface text-ink-2'}" onclick={() => (calendarOpen = true)}>
			<CalendarDays class="size-4" />{f.date ? fmtDate(f.date).slice(0, 5) : 'Data'}
		</button>
	</div>
	<div class="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
		<WarehouseDockFilters refs={data.context.refs} />
	</div>
	<SearchBox bind:value={() => q, onSearch} placeholder="Dostawca, nr ZZ, awizacja, rejestracja…" />
	<p class="px-1 text-xs text-muted">
		<b class="text-ink">{data.advices.length}</b>
		{plural(data.advices.length, 'awizacja', 'awizacje', 'awizacji')}
	</p>
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each data.advices as a (a.id)}
		<li>
			<button type="button" class="flex w-full gap-3 overflow-hidden rounded-2xl border border-line bg-surface text-left active:bg-bg" onclick={() => open(a)}>
				<div class="flex w-17 shrink-0 flex-col items-center justify-center gap-0.5 py-3 {a.late ? 'bg-bad-soft text-bad' : 'bg-bg text-ink-2'}">
					{#if multiDay}<span class="mb-0.5 text-[10px] font-extrabold uppercase">{fmtDay(a.date)}</span>{/if}
					<span class="font-mono text-lg leading-none font-extrabold">{a.slotFrom}</span>
					<span class="font-mono text-[11px] opacity-70">–{a.slotTo}</span>
					<span class="mt-1 text-[11px] font-extrabold">{a.dock.name}</span>
				</div>
				<div class="min-w-0 flex-1 py-3 pr-3">
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-[15px] font-extrabold">{a.supplier.name}</p>
						{#if a.flags.qc}<ProductFlags flags={{ qc: true, batch: false, serial: false }} size="sm" />{/if}
					</div>
					<p class="mt-0.5 truncate font-mono text-xs text-muted">{a.number} · {a.purchaseOrders.map((p) => p.number).join(', ')}</p>
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
						<span class="flex items-center gap-1"><Warehouse class="size-3.5" />{a.warehouse.code}</span>
						<span class="flex items-center gap-1"><Truck class="size-3.5" />{a.vehicle.plate}</span>
						<span class="font-bold text-ink">{a.lines} poz.</span>
						{#if a.pallets}<span class="flex items-center gap-1"><Layers class="size-3.5" />{a.pallets} {plural(a.pallets, 'paleta', 'palety', 'palet')}</span>{/if}
					</div>
					{#if a.openReceipt || a.partiallyReceived || a.late}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#if a.openReceipt}<Badge tone={a.openReceipt.status === 'AWAITING_APPROVAL' ? 'warn' : 'task'}><Truck />{a.openReceipt.status === 'AWAITING_APPROVAL' ? 'Rozładunek – czeka na akceptację' : 'Rozładunek w toku'}</Badge>{/if}
							{#if a.partiallyReceived}<Badge tone="info">Reszta do przyjęcia</Badge>{/if}
							{#if a.late}<Badge tone="bad"><Clock />Spóźnione</Badge>{/if}
						</div>
					{/if}
				</div>
			</button>
		</li>
	{:else}
		<li><Empty>Brak awizacji dla wybranych filtrów</Empty></li>
	{/each}
</ul>

<DatePickerSheet bind:open={calendarOpen} value={f.date} title="Dzień dostawy" onPick={pickDate} onClear={() => setParams({ data: null, dni: null })} />

<Sheet bind:open={detailOpen} title={detail?.supplier.name ?? 'Awizacja'} description={detail ? `${detail.number} · ${fmtDayLong(detail.date)} ${detail.slotFrom}–${detail.slotTo}` : ''}>
	{#if !detail}
		<p class="py-8 text-center text-muted">Wczytuję…</p>
	{:else}
		<dl class="divide-y divide-line rounded-xl border border-line text-sm">
			<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Magazyn / DOK</dt><dd class="font-semibold">{detail.warehouse.code} · {detail.dock.name}</dd></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Auto</dt><dd class="font-mono font-semibold">{detail.vehicle.plate}</dd></div>
			{#if detail.pallets}<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Palety</dt><dd class="font-semibold">{detail.pallets}</dd></div>{/if}
			<div class="flex items-center justify-between gap-4 px-3 py-2.5">
				<dt class="text-muted">Kierowca</dt>
				<dd class="flex items-center gap-2 font-semibold">{detail.vehicle.driver}<a href="tel:{detail.vehicle.phone.replaceAll(' ', '')}" class="grid size-8 place-items-center rounded-full bg-ok-soft text-ok" aria-label="Zadzwoń"><Phone class="size-4" /></a></dd>
			</div>
		</dl>
		{#if detail.note}<p class="mt-3 flex gap-2 rounded-xl bg-info-soft p-3 text-sm text-info"><MessageSquareText class="size-5 shrink-0" />{detail.note}</p>{/if}

		<p class="mt-4 mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Pozycje ({detail.items.length})</p>
		<ul class="divide-y divide-line rounded-xl border border-line text-sm">
			{#each detail.items as it, i (i)}
				<li class="flex items-start gap-3 px-3 py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{it.product.name}</p>
						<p class="font-mono text-xs text-muted">{it.product.sku} · {it.poNumber}</p>
						{#if it.product.requiresQc || it.product.tracking !== 'NONE'}<div class="mt-1 flex gap-1"><ProductFlags product={it.product} size="sm" /></div>{/if}
					</div>
					<span class="text-right font-mono text-sm font-bold whitespace-nowrap">{it.remaining} <span class="font-normal text-muted">{it.product.unit}</span></span>
				</li>
			{/each}
		</ul>
		{#if detail.partiallyReceived && !detail.openReceipt}
			<p class="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Częściowo przyjęte ({detail.receipts.map((r) => r.number).join(', ')}). Rozładunek obejmie tylko pozostałe {detail.remainingQty} szt.</p>
		{/if}
	{/if}
	{#snippet footer()}
		{#if detail}
			<Button variant="task" size="lg" loading={busy} onclick={start}>
				{detail.openReceipt ? 'Kontynuuj rozładunek' : 'Rozpocznij rozładunek'}<ArrowRight class="size-5" />
			</Button>
		{/if}
	{/snippet}
</Sheet>
