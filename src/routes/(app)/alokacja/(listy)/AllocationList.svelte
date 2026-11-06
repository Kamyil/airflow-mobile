<script lang="ts">
	import type { AllocationSummaryDTO, RefsDTO } from '$lib/types';
	import { fmtDateTime } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import WarehouseFilter from '$lib/components/WarehouseFilter.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { orders, refs, empty }: { orders: AllocationSummaryDTO[]; refs: RefsDTO; empty: string } = $props();
	const LABEL = { TODO: 'Do alokacji', IN_PROGRESS: 'W trakcie', DONE: 'Zakończone' } as const;
</script>

<div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3"><WarehouseFilter {refs} /></div>

<ul class="flex flex-col gap-3 p-3">
	{#each orders as o (o.id)}
		<li>
			<a href="/alokacja/{o.id}" class="block rounded-2xl border border-line bg-surface p-4 active:bg-bg">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-mono text-[15px] font-bold">{o.number}</p>
						<p class="truncate font-semibold text-ink-2">{o.supplier.name}</p>
						<p class="font-mono text-xs text-muted">{o.receipt.number}</p>
					</div>
					<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-1.5">
					<StatusBadge status={o.status} label={LABEL[o.status]} />
					<Badge>{o.warehouse.code}</Badge>
					<Badge><MapPin />{o.fromLocations.join(', ')}</Badge>
					<ProductFlags flags={o.flags} size="sm" />
				</div>
				<div class="mt-3"><Progress value={o.progress.linesDone} max={o.progress.lines} label="{o.progress.linesDone}/{o.progress.lines} poz. · {o.progress.qtyDone}/{o.progress.qty} szt." /></div>
				<p class="mt-2 text-xs text-muted">{o.doneAt ? `Zakończone ${fmtDateTime(o.doneAt)}` : `Wygenerowane ${fmtDateTime(o.createdAt)}`}</p>
			</a>
		</li>
	{:else}
		<li><Empty>{empty}</Empty></li>
	{/each}
</ul>
