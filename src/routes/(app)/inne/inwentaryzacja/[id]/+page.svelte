<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, finishInventory, verifySupervisorPin } from '$lib/api';
	import { toast } from '$lib/toast.svelte';
	import { fmtDayLong, fmtDiff, fmtTime } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import SupervisorSheet from '$lib/components/SupervisorSheet.svelte';
	import Check from '@lucide/svelte/icons/check';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Lock from '@lucide/svelte/icons/lock';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	let { data } = $props();
	let inv = $derived(data.inventory);
	let done = $derived(inv.status === 'DONE');
	let next = $derived(inv.locations.find((l) => !l.counted));
	let busy = $state(false);
	let summaryOpen = $state(false);
	let approvalOpen = $state(false);

	function onScan(code: string): string | null {
		let loc = inv.locations.find((l) => l.code === code);
		if (!loc) return `Lokalizacja ${code} nie należy do tej inwentaryzacji`;
		goto(`/inne/inwentaryzacja/${inv.id}/${loc.code}`);
		return null;
	}

	async function finish(approval?: { pin: string; note: string }) {
		busy = true;
		try {
			let { diffs } = await finishInventory(inv.id, approval);
			toast.ok(`${inv.number} zakończona`, diffs ? `Skorygowano stany: ${diffs} poz.` : 'Bez różnic');
			summaryOpen = false;
			approvalOpen = false;
			await invalidateAll();
		} catch (e) {
			if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
				summaryOpen = false;
				approvalOpen = true;
			} else toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function approve(pin: string, note: string) {
		try {
			await verifySupervisorPin(pin);
			await finish({ pin, note });
			return null;
		} catch (e) {
			return e instanceof ApiError ? e.message : 'Błąd';
		}
	}
</script>

<PageHeader title={inv.number} subtitle={inv.name} back="/inne/inwentaryzacja" />

<div class="flex flex-col gap-3 p-3 {done ? '' : 'pb-28'}">
	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<div class="flex flex-wrap gap-1.5"><Badge>{inv.warehouse.code}</Badge><Badge>termin {fmtDayLong(inv.dueDate)}</Badge>{#if inv.diffs.length}<Badge tone="warn"><TriangleAlert />Różnice: {inv.diffs.length}</Badge>{/if}</div>
		<div class="mt-3"><Progress value={inv.progress.counted} max={inv.progress.locations} label="{inv.progress.counted}/{inv.progress.locations} lokalizacji" /></div>
		{#if inv.approval}<p class="mt-3 flex items-center gap-2 rounded-xl bg-info-soft p-2.5 text-sm text-info"><ShieldCheck class="size-4" />Zatwierdził(a) {inv.approval.by}{inv.approval.note ? ` – „${inv.approval.note}”` : ''}</p>{/if}
	</section>

	{#if !done}
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="mb-2 text-sm font-bold">{next ? `Następna: ${next.code}` : 'Wszystkie lokalizacje policzone'} – zeskanuj lokalizację</p>
			<ScanInput placeholder="Kod lokalizacji" {onScan} hints={next ? [{ code: next.code }] : []} autofocus={false} />
		</section>
	{/if}

	<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
		{#each inv.locations as l (l.code)}
			<li class="border-t border-line first:border-0">
				<a href={done ? undefined : `/inne/inwentaryzacja/${inv.id}/${l.code}`} class="flex items-center gap-3 p-3 {done ? '' : 'active:bg-bg'}">
					<span class="grid size-8 shrink-0 place-items-center rounded-full {l.counted ? (l.diffs ? 'bg-warn text-white' : 'bg-ok text-white') : 'bg-bg text-muted'}">
						{#if l.counted}{#if l.diffs}<TriangleAlert class="size-4" />{:else}<Check class="size-4" strokeWidth={3} />{/if}{:else}<MapPin class="size-4" />{/if}
					</span>
					<span class="min-w-0 flex-1">
						<b class="block font-mono">{l.code}</b>
						<span class="block truncate text-xs text-muted">{l.items.length ? [...new Set(l.items.map((i) => i.product.sku))].join(', ') : 'pusta w systemie'}{l.counted ? ` · ${l.countedBy}, ${fmtTime(l.countedAt!)}` : ''}</span>
					</span>
					{#if l.diffs}<Badge tone="warn">{l.diffs} różn.</Badge>{/if}
					{#if !done}<ChevronRight class="size-4 text-muted" />{/if}
				</a>
			</li>
		{/each}
	</ul>

	{#if inv.diffs.length}
		<section>
			<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Różnice</h2>
			<ul class="divide-y divide-line overflow-hidden rounded-2xl bg-surface text-sm ring-1 ring-line">
				{#each inv.diffs as d, i (i)}
					<li class="flex items-center justify-between gap-3 p-3">
						<span class="min-w-0"><b class="block truncate">{d.product.name}</b><span class="font-mono text-xs text-muted">{d.location}{d.batch ? ` · ${d.batch}` : ''} · system {d.systemQty}, policzono {d.countedQty}</span></span>
						<b class="font-mono {d.diff < 0 ? 'text-bad' : 'text-warn'}">{fmtDiff(d.diff)}</b>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

{#if !done}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3"><Button variant={next ? 'primary' : 'ok'} size="lg" class="w-full" disabled={!!next} onclick={() => (summaryOpen = true)}><Lock class="size-5" />{next ? `Pozostało ${inv.progress.locations - inv.progress.counted} lokalizacji` : 'Zakończ inwentaryzację'}</Button></div>
	</div>
{/if}

<Sheet bind:open={summaryOpen} title="Zakończyć inwentaryzację?" description="{inv.number} · {inv.name}">
	{#if inv.diffs.length}
		<p class="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">Różnice: {inv.diffs.length}. Stany zostaną skorygowane do policzonych ilości – wymaga to zatwierdzenia przełożonego.</p>
	{:else}
		<p class="flex items-center gap-2 rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok"><Check class="size-5" />Stany zgodne z systemem</p>
	{/if}
	{#snippet footer()}
		<Button variant="primary" size="lg" loading={busy} onclick={() => finish()}>{inv.diffs.length ? 'Dalej – zatwierdzenie przełożonego' : 'Zakończ'}</Button>
	{/snippet}
</Sheet>

<SupervisorSheet bind:open={approvalOpen} title="Zatwierdzenie różnic" description={inv.number} onConfirm={approve}>
	<ul class="divide-y divide-line rounded-xl border border-line text-sm">
		{#each inv.diffs as d, i (i)}<li class="flex justify-between gap-3 px-3 py-2"><span class="truncate">{d.location} · {d.product.sku}</span><b class="font-mono">{fmtDiff(d.diff)}</b></li>{/each}
	</ul>
</SupervisorSheet>
