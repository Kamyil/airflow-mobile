<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { generateMwsOrder } from '$lib/api';
	import type { ReceiptDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import Button from '$lib/components/Button.svelte';
	import { fmtDateTime } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import Tag from '@lucide/svelte/icons/tag';
	import Layers from '@lucide/svelte/icons/layers';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import FileText from '@lucide/svelte/icons/file-text';
	import Ban from '@lucide/svelte/icons/ban';

	let { r }: { r: ReceiptDTO } = $props();

	let busy = $state(false);
	async function generate() {
		busy = true;
		try {
			let { number } = await generateMwsOrder(r.id);
			toast.ok(`Wygenerowano ${number}`, `${r.number} · zlecenie trafiło do Alokacji`);
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
	const ALLOC = { TODO: 'do alokacji', IN_PROGRESS: 'alokacja w trakcie', DONE: 'zaalokowane' } as const;
</script>

<div class="overflow-hidden rounded-2xl border bg-surface {r.status === 'AWAITING_APPROVAL' ? 'border-warn/50' : 'border-line'}">
<a href="/dostawy/pz/{r.id}" class="block p-4 active:bg-bg">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<p class="font-mono text-[15px] font-bold">{r.number}</p>
			<p class="truncate text-[15px] font-semibold text-ink-2">{r.supplier.name}</p>
			<p class="mt-0.5 truncate font-mono text-xs text-muted">{r.advice.number} · {r.purchaseOrders.map((p) => p.number).join(', ')}</p>
		</div>
		<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
	</div>
	<div class="mt-2 flex flex-wrap items-center gap-1.5">
		<StatusBadge status={r.statusKey} />
		<Badge>{r.warehouse.code} · {r.dock.name}</Badge>
		<ProductFlags flags={r.flags} size="sm" />
	</div>
	{#if r.status !== 'DONE'}
		<p class="mt-3 flex items-center gap-1.5 text-sm {r.carriers.received === null ? 'text-muted' : r.carriers.diff ? 'font-bold text-warn' : 'font-bold'}"><Layers class="size-4" />{r.carriers.received === null ? 'Nośniki: nie podano' : `Nośniki: ${r.carriers.received}`}{r.carriers.advised !== null ? ` / awizowano ${r.carriers.advised}` : ''}</p>
		<p class="mt-2 text-xs text-muted">Utworzył(a) {r.createdBy} · {fmtDateTime(r.createdAt)}</p>
	{:else}
		<p class="mt-2 text-xs text-muted">Przyjął(a) {r.closedBy} · {fmtDateTime(r.closedAt!)}{r.carriers.received !== null ? ` · nośniki: ${r.carriers.received}` : ''}</p>
	{/if}
	<div class="mt-2 flex flex-wrap gap-1.5">
		<!-- zlecenie MWS: zawsze widoczne, czy jest wygenerowane -->
		{#if r.allocation}<Badge tone={r.allocation.status === 'DONE' ? 'ok' : 'task'}><ArrowDownToLine />MWS {r.allocation.number} · {ALLOC[r.allocation.status]}</Badge>
		{:else if r.mwsSkipped}<Badge tone="warn"><Ban />Bez zlecenia MWS</Badge>
		{:else if r.status === 'AWAITING_APPROVAL' && r.pendingMws !== null}<Badge><CircleDashed />{r.pendingMws ? 'MWS po akceptacji' : 'Bez MWS (po akceptacji)'}</Badge>
		{:else}<Badge><CircleDashed />MWS: nie wygenerowano</Badge>{/if}
		{#if r.approval}<Badge tone="info"><ShieldCheck />Rozbieżności zatwierdzone</Badge>{/if}
		{#if r.documents.length}<Badge><FileText />Dokumenty: {r.documents.length}</Badge>{/if}
		{#if r.labelsPrintedAt}<Badge><Tag />Etykiety</Badge>{/if}
	</div>
</a>
{#if r.mwsSkipped}
	<div class="border-t border-line bg-bg/60 p-2">
		<Button variant="task" class="w-full" loading={busy} onclick={generate}><ArrowDownToLine class="size-4" />Generuj zlecenie MWS</Button>
	</div>
{/if}
</div>
