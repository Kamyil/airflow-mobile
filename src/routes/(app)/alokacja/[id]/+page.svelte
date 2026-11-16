<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { alternativeLocations, ApiError, checkPutawayLocation, deferPutaway, placePutaway } from '$lib/api';
	import type { PutawayLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate, fmtTime } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	let { data } = $props();
	let o = $derived(data.order);
	let current = $derived(o.current);
	let busy = $state(false);

	type Tab = 'zadanie' | 'lista';
	let tab = $derived((page.url.searchParams.get('tab') as Tab) ?? 'zadanie');
	const setTab = (t: Tab) => goto(t === 'zadanie' ? '?' : `?tab=${t}`, { replaceState: true, noScroll: true, keepFocus: true });

	// --- ilość + skan półki, na którą magazynier faktycznie odkłada ---
	let qty = $state(0);
	let target = $state<string | null>(null);

	// nowa pozycja w kolejce -> od początku, z podpowiedzią Impulsa
	$effect.pre(() => {
		current?.id;
		current?.remainingQty;
		qty = current?.remainingQty ?? 0;
		target = current?.suggestedLocation ?? null;
	});

	// zeskanowana inna półka niż proponowana – czeka na decyzję magazyniera
	let otherShelf = $state<string | null>(null);
	let otherOpen = $state(false);
	$effect(() => {
		if (!otherOpen) otherShelf = null;
	});

	async function onLocation(code: string): Promise<string | null> {
		if (!current) return null;
		try {
			let shelf = await checkPutawayLocation(o.id, code);
			if (shelf !== target) {
				otherShelf = shelf;
				otherOpen = true;
				return null;
			}
			return await place(shelf);
		} catch (e) {
			if (e instanceof ApiError) return e.message;
			throw e;
		}
	}

	async function place(code: string): Promise<string | null> {
		if (!current) return null;
		let line = current;
		busy = true;
		try {
			let { done } = await placePutaway({ orderId: o.id, lineId: line.id, location: code, qty });
			otherOpen = false;
			if (code !== line.suggestedLocation) toast.info(`Odłożono ${qty} ${line.product.unit} → ${code}`, `Inna półka niż podpowiedź Impulsa (${line.suggestedLocation})`);
			else toast.ok(`Odłożono ${qty} ${line.product.unit} → ${code}`, line.product.name);
			if (done) toast.ok(`${o.number} zakończone`, 'Cały towar jest na półkach.');
			await invalidateAll();
			return null;
		} catch (e) {
			otherOpen = false;
			toast.error(e);
			return null;
		} finally {
			busy = false;
		}
	}

	async function skip() {
		if (!current) return;
		busy = true;
		try {
			await deferPutaway(o.id, current.id);
			toast.info('Pozycja przeniesiona na koniec kolejki');
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	// --- inna lokalizacja ---
	let altOpen = $state(false);
	let alternatives = $state<{ code: string; reason: string }[]>([]);
	async function openAlternatives() {
		if (!current) return;
		alternatives = [];
		altOpen = true;
		alternatives = await alternativeLocations(o.id, current.id);
	}
	function pickAlternative(code: string) {
		target = code;
		altOpen = false;
		toast.info(`Cel zmieniony na ${code}`, 'Zeskanuj kod tej lokalizacji.');
	}

	const lineDone = (l: PutawayLineDTO) => l.remainingQty === 0;
</script>

<PageHeader title={o.number} subtitle="{o.receipt.number} · {o.supplier.name}" back="/alokacja" />

<div class="bg-bg px-3 pt-3">
	<div class="grid grid-cols-2 rounded-xl bg-ink/6 p-1">
		{#each [{ id: 'zadanie' as Tab, label: 'Zadanie' }, { id: 'lista' as Tab, label: `Lista (${o.lines.length})` }] as t (t.id)}
			<button type="button" class="h-10 rounded-lg text-sm font-bold {tab === t.id ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => setTab(t.id)}>{t.label}</button>
		{/each}
	</div>
	<div class="py-2"><Progress value={o.progress.qtyDone} max={o.progress.qty} label="{o.progress.linesDone}/{o.progress.lines} poz." /></div>
</div>

<div class="flex flex-col gap-3 px-3 pb-6">
	{#if tab === 'zadanie'}
		{#if current}
			<section class="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
				<div class="flex items-center gap-3 bg-bg px-4 py-3">
					<span class="grid size-9 place-items-center rounded-full bg-ink/8"><MapPin class="size-5" /></span>
					<div class="flex-1">
						<p class="text-xs text-muted">Weź z miejsca odstawczego</p>
						<p class="font-mono text-lg font-extrabold">{current.fromLocation}</p>
					</div>
					<span class="text-xs text-muted">poz. {current.seq}/{o.lines.length}</span>
				</div>
				<div class="p-4">
					<p class="text-lg leading-tight font-extrabold">{current.product.name}</p>
					<p class="mt-0.5 font-mono text-xs text-muted">{current.product.sku} · EAN {current.product.ean}</p>
					<div class="mt-2 flex flex-wrap gap-1.5">
						<ProductFlags product={current.product} />
						{#if current.batch}<Badge tone="info">Seria {current.batch}{current.expiry ? ` · do ${fmtDate(current.expiry)}` : ''}</Badge>{/if}
						{#if current.serials.length}<Badge>{current.serials.length} SN</Badge>{/if}
						{#if current.deferred}<Badge tone="warn">Odłożona</Badge>{/if}
					</div>
					<p class="mt-3 font-mono text-3xl font-extrabold">{current.remainingQty} <span class="text-base font-normal text-muted">{current.product.unit}{current.placedQty ? ` (z ${current.qty})` : ''}</span></p>
				</div>
				<div class="flex justify-center"><ArrowDown class="size-6 text-muted" /></div>
				<div class="m-3 rounded-2xl bg-task p-4 text-task-ink">
					<p class="flex items-center gap-1.5 text-xs font-bold uppercase"><Lightbulb class="size-4" />{target === current.suggestedLocation ? 'Podpowiedź Impulsa – odłóż na' : 'Wybrana lokalizacja'}</p>
					<div class="flex items-center justify-between gap-2">
						<p class="font-mono text-4xl font-extrabold tracking-tight">{target}</p>
						<button type="button" class="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-task-ink/10 px-3 text-sm font-bold active:bg-task-ink/20 disabled:opacity-40" disabled={busy} onclick={openAlternatives}><Shuffle class="size-4" />Inna</button>
					</div>
				</div>
				<!-- skan półki zaraz pod podpowiedzią -->
				<div class="px-4 pb-4">
					<p class="mb-1.5 text-sm font-bold">Zeskanuj półkę, na którą odkładasz</p>
					<ScanInput placeholder="Numer półki" onScan={onLocation} {busy} hints={[{ code: target!, label: target! }, { code: target === 'B-02-01-A' ? 'B-02-02-A' : 'B-02-01-A', label: 'inna półka' }]} />
				</div>
			</section>

			<!-- ilość (domyślnie całość) – zmieniasz przed skanem, gdy odkładasz część -->
			<section class="rounded-3xl bg-surface p-4 ring-1 ring-line">
				<p class="mb-1.5 text-sm font-bold">Ilość do odłożenia</p>
				<QtyStepper bind:value={qty} min={1} max={current.remainingQty} unit={current.product.unit} size="lg" />
				{#if qty < current.remainingQty}<p class="mt-1 text-xs text-muted">Częściowo – {current.remainingQty - qty} zostanie na {current.fromLocation}</p>{/if}
			</section>

			<Button disabled={busy || o.queue.length < 2} onclick={skip}><SkipForward class="size-4" />Pomiń pozycję</Button>
		{:else}
			<section class="flex flex-col items-center gap-2 rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
				<CircleCheckBig class="size-14 text-ok" />
				<p class="text-xl font-extrabold">Alokacja zakończona</p>
				<p class="text-sm text-muted">Cały towar z {o.receipt.number} jest na półkach{o.doneAt ? ` (${fmtTime(o.doneAt)})` : ''}.</p>
				<div class="mt-3 grid w-full gap-2">
					<Button variant="primary" size="lg" href="/alokacja">Do listy zleceń</Button>
					<Button href="/dostawy/pz/{o.receipt.id}">Podgląd {o.receipt.number}</Button>
				</div>
			</section>
		{/if}
	{:else}
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each o.lines as l (l.id)}
				<li class="flex items-start gap-3 border-t border-line p-3 first:border-0 {l.id === current?.id ? 'bg-task-soft' : ''}">
					<span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold {lineDone(l) ? 'bg-ok text-white' : 'bg-bg text-muted'}">{#if lineDone(l)}<Check class="size-4" strokeWidth={3} />{:else}{l.seq}{/if}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{l.product.name}</p>
						<p class="font-mono text-xs text-muted">{l.fromLocation} → <b class="text-ink">{l.suggestedLocation}</b>{l.batch ? ` · ${l.batch}` : ''}</p>
						{#each l.placements as p, i (i)}
							<p class="text-xs text-ok">✓ {p.qty} → {p.location}{#if p.location !== l.suggestedLocation}<span class="font-bold text-warn"> (inna niż podpowiedź)</span>{/if} · {p.by}, {fmtTime(p.at)}</p>
						{/each}
					</div>
					<span class="font-mono font-bold whitespace-nowrap">{l.placedQty}/{l.qty}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Sheet bind:open={altOpen} title="Inna lokalizacja" description="Podpowiadane miejsce jest zajęte albo pełne? Wybierz inne.">
	{#if !alternatives.length}
		<p class="py-6 text-center text-muted">Szukam wolnych miejsc…</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each alternatives as a (a.code)}
				<li>
					<button type="button" class="flex w-full items-center gap-3 rounded-2xl border-2 border-line p-3 text-left active:border-ink active:bg-task-soft" onclick={() => pickAlternative(a.code)}>
						<MapPin class="size-5 text-muted" />
						<span class="flex-1"><b class="block font-mono text-lg">{a.code}</b><span class="text-xs text-muted">{a.reason}</span></span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-muted">Możesz też od razu zeskanować dowolną inną półkę.</p>
	{/if}
</Sheet>

<!-- inna półka niż proponowana -->
<Sheet bind:open={otherOpen} title="Inna półka niż proponowana" description={current ? `${current.product.name} · ${qty} ${current.product.unit}` : ''}>
	{#if current && otherShelf}
		<p class="flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Odkładasz towar na inną półkę niż proponowana. Czy chcesz tutaj zostawić towar, czy wrócić do proponowanej półki?</p>
		<div class="mt-3 grid grid-cols-2 gap-2 text-center">
			<div class="rounded-2xl bg-bg p-3"><p class="text-xs text-muted">Proponowana</p><p class="font-mono text-xl font-extrabold">{target}</p></div>
			<div class="rounded-2xl bg-task-soft p-3"><p class="text-xs text-muted">Zeskanowana</p><p class="font-mono text-xl font-extrabold">{otherShelf}</p></div>
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="task" size="lg" loading={busy} onclick={() => otherShelf && place(otherShelf)}><Check class="size-5" />Zostaw na {otherShelf}</Button>
		<Button size="lg" disabled={busy} onclick={() => (otherOpen = false)}><Undo2 class="size-5" />Wróć do proponowanej ({target})</Button>
	{/snippet}
</Sheet>
