<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { ApiError, findProduct, sampleExtraProducts, saveLocationCount, type CountInput } from '$lib/api';
	import type { Product } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDiff } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { data } = $props();
	let inv = $derived(data.inventory);
	let loc = $derived(data.location);

	// policzone ilości – startowo z poprzedniego liczenia (null = jeszcze nie potwierdzone)
	type Row = { id: string | null; product: Product; batch: string | null; systemQty: number; counted: number | null; extra: boolean };
	let rows = $state<Row[]>(
		untrack(() => data.location.items.map((i) => ({ id: i.id, product: i.product, batch: i.batch, systemQty: i.systemQty, counted: i.countedQty, extra: i.extra })))
	);
	let confirmedLocation = $state(untrack(() => data.location.counted));
	let busy = $state(false);
	let adding = $state(false);
	let extraHints = $state<{ ean: string; sku: string }[]>([]);
	$effect(() => {
		sampleExtraProducts(inv.id, loc.code).then((h) => (extraHints = h));
	});

	let pending = $derived(rows.filter((r) => r.counted === null).length);

	function onLocation(code: string): string | null {
		if (code !== loc.code) return `To nie ta lokalizacja – idź do ${loc.code}`;
		confirmedLocation = true;
		return null;
	}

	async function onExtra(code: string): Promise<string | null> {
		try {
			let product = await findProduct(code);
			if (rows.some((r) => r.product.id === product.id && r.extra)) return `${product.sku} jest już na liście`;
			rows.push({ id: null, product, batch: null, systemQty: 0, counted: 1, extra: true });
			adding = false;
			return null;
		} catch (e) {
			return e instanceof ApiError ? e.message : String(e);
		}
	}

	async function save() {
		busy = true;
		try {
			let items: CountInput[] = rows.map((r) => ({ id: r.id, productId: r.product.id, batch: r.batch, countedQty: r.counted ?? 0 }));
			await saveLocationCount(inv.id, loc.code, items);
			let diffs = rows.filter((r) => (r.counted ?? 0) !== r.systemQty).length;
			toast.ok(`${loc.code} policzona`, diffs ? `Różnice: ${diffs}` : 'Zgodne ze stanem');
			await goto(`/inne/inwentaryzacja/${inv.id}`, { invalidateAll: true });
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

<PageHeader title={loc.code} subtitle="{inv.number} · {inv.name}" back="/inne/inwentaryzacja/{inv.id}" />

<div class="flex flex-col gap-3 p-3 pb-28">
	{#if !confirmedLocation}
		<section class="rounded-2xl bg-task-soft p-4 ring-1 ring-task">
			<p class="mb-2 flex items-center gap-2 font-bold"><MapPin class="size-5" />Zeskanuj lokalizację {loc.code}</p>
			<ScanInput placeholder="Kod lokalizacji" onScan={onLocation} hints={[{ code: loc.code }]} />
		</section>
	{:else}
		{#each rows as r, i (r.id ?? `x${i}`)}
			{@const diff = r.counted === null ? null : r.counted - r.systemQty}
			<section class="rounded-2xl bg-surface p-4 ring-1 {r.counted === null ? 'ring-line' : diff ? 'ring-warn' : 'ring-ok'}">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-bold">{r.product.name}</p>
						<p class="font-mono text-xs text-muted">{r.product.sku}{r.batch ? ` · seria ${r.batch}` : ''}</p>
						<div class="mt-1 flex flex-wrap gap-1"><ProductFlags product={r.product} size="sm" />{#if r.extra}<Badge tone="info">Dodatkowy</Badge>{/if}</div>
					</div>
					{#if r.extra}
						<button type="button" class="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Usuń" onclick={() => rows.splice(i, 1)}><X class="size-4" /></button>
					{:else}
						<div class="text-right"><p class="text-[11px] text-muted uppercase">W systemie</p><p class="font-mono text-xl font-extrabold">{r.systemQty}</p></div>
					{/if}
				</div>
				{#if r.counted === null}
					<div class="mt-3 grid grid-cols-2 gap-2">
						<Button variant="ok" onclick={() => (r.counted = r.systemQty)}><Check class="size-4" />Zgodne ({r.systemQty})</Button>
						<Button onclick={() => (r.counted = r.systemQty)}>Koryguj</Button>
					</div>
				{:else}
					<div class="mt-3 flex items-center gap-3">
						<QtyStepper bind:value={r.counted} min={0} max={9999} unit={r.product.unit} class="flex-1" />
						{#if diff}<b class="w-12 text-right font-mono {diff < 0 ? 'text-bad' : 'text-warn'}">{fmtDiff(diff)}</b>{:else}<Check class="size-6 text-ok" />{/if}
					</div>
				{/if}
			</section>
		{:else}
			<p class="rounded-2xl bg-surface p-6 text-center text-muted ring-1 ring-line">Lokalizacja jest pusta w systemie. Jeśli coś na niej leży – dodaj produkt.</p>
		{/each}

		{#if adding}
			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<p class="mb-2 text-sm font-bold">Zeskanuj znaleziony produkt</p>
				<ScanInput placeholder="EAN / indeks" onScan={onExtra} hints={extraHints.map((h) => ({ code: h.ean, label: h.sku }))} />
			</section>
		{:else}
			<Button onclick={() => (adding = true)}><Plus class="size-4" />Produkt spoza systemu</Button>
		{/if}
	{/if}
</div>

{#if confirmedLocation}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3"><Button variant="task" size="lg" class="w-full" disabled={pending > 0} loading={busy} onclick={save}><Check class="size-5" />{pending ? `Potwierdź pozycje (${pending})` : 'Zapisz lokalizację'}</Button></div>
	</div>
{/if}
