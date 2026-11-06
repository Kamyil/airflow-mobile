<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getAdvice, setTruckStatus, startReceipt } from '$lib/api';
	import type { AdviceDetailDTO, AdviceDTO, TruckStatus } from '$lib/types';
	import { setParams } from '$lib/url';
	import { toast } from '$lib/toast.svelte';
	import { fmtDayLong, fmtTime, plural } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import ChipSelect from '$lib/components/ChipSelect.svelte';
	import DayPicker from '$lib/components/DayPicker.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import WarehouseDockFilters from '../WarehouseDockFilters.svelte';
	import Truck from '@lucide/svelte/icons/truck';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import Clock from '@lucide/svelte/icons/clock';
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

	const TRUCK: { value: TruckStatus; label: string }[] = [
		{ value: 'AWIZOWANE', label: 'Awizowane' },
		{ value: 'NA_PLACU', label: 'Na placu' },
		{ value: 'POD_DOKIEM', label: 'Pod DOKiem' }
	];
	const HOURS = Array.from({ length: 11 }, (_, i) => String(6 + i).padStart(2, '0')).map((h) => ({ value: h, label: `${h}:00–${String(+h + 1).padStart(2, '0')}:00` }));

	let atDock = $derived(data.advices.filter((a) => a.truckStatus === 'POD_DOKIEM').length);

	// --- szczegóły awizacji ---
	let detail = $state<AdviceDetailDTO | null>(null);
	let detailOpen = $state(false);
	let busy = $state(false);

	async function open(a: AdviceDTO) {
		detail = null;
		detailOpen = true;
		try {
			detail = await getAdvice(a.id);
		} catch (e) {
			toast.error(e);
			detailOpen = false;
		}
	}

	async function truck(status: TruckStatus) {
		if (!detail) return;
		busy = true;
		try {
			await setTruckStatus(detail.id, status);
			detail = await getAdvice(detail.id);
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function start() {
		if (!detail) return;
		busy = true;
		try {
			let { receiptId, created } = await startReceipt(detail.id);
			if (created) toast.ok('Utworzono PZ', `${detail.supplier.name} · ${detail.dock.name}`);
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
	<DayPicker value={f.date} onChange={(d) => setParams({ dzien: d })} />
	<div class="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
		<WarehouseDockFilters refs={data.context.refs} />
		<ChipSelect label="Status auta" value={f.truckStatus} options={TRUCK} onChange={(v) => setParams({ auto: v })} />
		<ChipSelect label="Godzina" value={f.hour} options={HOURS} allLabel="Cały dzień" onChange={(v) => setParams({ h: v })} />
	</div>
	<SearchBox bind:value={() => q, onSearch} placeholder="Dostawca, nr ZZ, awizacja, rejestracja…" />
	<p class="px-1 text-xs text-muted">
		{fmtDayLong(f.date)}: <b class="text-ink">{data.advices.length}</b>
		{plural(data.advices.length, 'awizacja', 'awizacje', 'awizacji')} · pod DOKiem <b class="text-ink">{atDock}</b>
	</p>
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each data.advices as a (a.id)}
		<li>
			<button type="button" class="flex w-full gap-3 overflow-hidden rounded-2xl border bg-surface text-left active:bg-bg {a.openReceipt ? 'border-task' : 'border-line'}" onclick={() => open(a)}>
				<div class="flex w-17 shrink-0 flex-col items-center justify-center gap-0.5 py-3 {a.truckStatus === 'POD_DOKIEM' ? 'bg-ok-soft text-ok' : a.late ? 'bg-bad-soft text-bad' : 'bg-bg text-ink-2'}">
					<span class="font-mono text-lg leading-none font-extrabold">{a.slotFrom}</span>
					<span class="font-mono text-[11px] opacity-70">–{a.slotTo}</span>
					<span class="mt-1 text-[11px] font-extrabold">{a.dock.name}</span>
				</div>
				<div class="min-w-0 flex-1 py-3 pr-3">
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-[15px] font-extrabold">{a.supplier.name}</p>
						<StatusBadge status={a.truckStatus} />
					</div>
					<p class="mt-0.5 truncate font-mono text-xs text-muted">{a.number} · {a.purchaseOrders.map((p) => p.number).join(', ')}</p>
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
						<span class="flex items-center gap-1"><Warehouse class="size-3.5" />{a.warehouse.code}</span>
						<span class="flex items-center gap-1"><Truck class="size-3.5" />{a.vehicle.plate}</span>
						<span>{a.lines} poz.</span>
						<ProductFlags flags={a.flags} size="sm" />
					</div>
					{#if a.partiallyReceived}
						<div class="mt-2"><Progress value={a.receivedQty} max={a.orderedQty} label="przyjęto {a.receivedQty}/{a.orderedQty}" /></div>
					{/if}
					{#if a.openReceipt || a.late}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#if a.openReceipt}<Badge tone="task">{a.openReceipt.number} w trakcie</Badge>{/if}
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

<Sheet bind:open={detailOpen} title={detail?.supplier.name ?? 'Awizacja'} description={detail ? `${detail.number} · ${fmtDayLong(detail.date)} ${detail.slotFrom}–${detail.slotTo}` : ''}>
	{#if !detail}
		<p class="py-8 text-center text-muted">Wczytuję…</p>
	{:else}
		<dl class="divide-y divide-line rounded-xl border border-line text-sm">
			<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Magazyn / DOK</dt><dd class="font-semibold">{detail.warehouse.code} · {detail.dock.name}</dd></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Auto</dt><dd class="font-mono font-semibold">{detail.vehicle.plate}</dd></div>
			<div class="flex items-center justify-between gap-4 px-3 py-2.5">
				<dt class="text-muted">Kierowca</dt>
				<dd class="flex items-center gap-2 font-semibold">{detail.vehicle.driver}<a href="tel:{detail.vehicle.phone.replaceAll(' ', '')}" class="grid size-8 place-items-center rounded-full bg-ok-soft text-ok" aria-label="Zadzwoń"><Phone class="size-4" /></a></dd>
			</div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><dt class="text-muted">Przyjazd</dt><dd class="font-semibold">{detail.arrivedAt ? fmtTime(detail.arrivedAt) : '—'}</dd></div>
		</dl>
		{#if detail.note}<p class="mt-3 flex gap-2 rounded-xl bg-info-soft p-3 text-sm text-info"><MessageSquareText class="size-5 shrink-0" />{detail.note}</p>{/if}

		<p class="mt-4 mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Status auta</p>
		<div class="grid grid-cols-3 gap-1.5">
			{#each TRUCK as t (t.value)}
				<button type="button" disabled={busy} class="h-11 rounded-xl border-2 text-sm font-bold {detail.truckStatus === t.value ? 'border-ink bg-ink text-white' : 'border-line bg-surface'}" onclick={() => truck(t.value)}>{t.label}</button>
			{/each}
		</div>

		<p class="mt-4 mb-1.5 flex items-center justify-between text-xs font-bold tracking-wide text-muted uppercase">
			<span>Pozycje ({detail.items.length})</span><ProductFlags flags={detail.flags} size="sm" />
		</p>
		<ul class="divide-y divide-line rounded-xl border border-line text-sm">
			{#each detail.items as it, i (i)}
				<li class="flex items-center gap-3 px-3 py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{it.product}</p>
						<p class="font-mono text-xs text-muted">{it.sku} · {it.poNumber}</p>
					</div>
					<span class="text-right font-mono text-sm font-bold whitespace-nowrap {it.received >= it.ordered ? 'text-ok' : ''}">{it.received ? `${it.received}/` : ''}{it.ordered}</span>
				</li>
			{/each}
		</ul>
		{#if detail.partiallyReceived && !detail.openReceipt}
			<p class="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Częściowo przyjęte ({detail.receipts.map((r) => r.number).join(', ')}). Nowa PZ obejmie tylko pozostałe {detail.remainingQty} szt.</p>
		{/if}
	{/if}
	{#snippet footer()}
		{#if detail}
			<Button variant="task" size="lg" loading={busy} onclick={start}>
				{detail.openReceipt ? `Kontynuuj ${detail.openReceipt.number}` : 'Rozpocznij przyjęcie (utwórz PZ)'}<ArrowRight class="size-5" />
			</Button>
		{/if}
	{/snippet}
</Sheet>
