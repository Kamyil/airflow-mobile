<script lang="ts">
	import type { InventoryDTO } from '$lib/types';
	import { fmtDateTime, fmtDayLong } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import WarehouseFilter from '$lib/components/WarehouseFilter.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();
	const STATUS = { TODO: 'Do zrobienia', IN_PROGRESS: 'W trakcie', DONE: 'Zakończona' } as const;
</script>

{#snippet card(i: InventoryDTO)}
	<a href="/inne/inwentaryzacja/{i.id}" class="block rounded-2xl border border-line bg-surface p-4 active:bg-bg">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0"><p class="font-mono text-[15px] font-bold">{i.number}</p><p class="font-semibold text-ink-2">{i.name}</p></div>
			<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
		</div>
		<div class="mt-2 flex flex-wrap gap-1.5">
			<StatusBadge status={i.status} label={STATUS[i.status]} />
			<Badge>{i.warehouse.code}</Badge>
			<Badge>termin {fmtDayLong(i.dueDate)}</Badge>
			{#if i.diffs.length}<Badge tone="warn"><TriangleAlert />Różnice: {i.diffs.length}</Badge>{/if}
		</div>
		{#if i.status !== 'DONE'}
			<div class="mt-3"><Progress value={i.progress.counted} max={i.progress.locations} label="{i.progress.counted}/{i.progress.locations} lokalizacji" /></div>
		{:else if i.doneAt}
			<p class="mt-2 text-xs text-muted">Zakończona {fmtDateTime(i.doneAt)}</p>
		{/if}
	</a>
{/snippet}

<PageHeader title="Inwentaryzacja" subtitle="Ze stanem systemowym" back="/inne" />

<div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3"><WarehouseFilter refs={data.context.refs} /></div>

<ul class="flex flex-col gap-3 p-3">
	{#each data.open as i (i.id)}<li>{@render card(i)}</li>{:else}<li><Empty>Brak zleceń inwentaryzacji</Empty></li>{/each}
</ul>
{#if data.done.length}
	<h2 class="px-4 pt-2 text-xs font-extrabold tracking-wide text-muted uppercase">Zakończone</h2>
	<ul class="flex flex-col gap-3 p-3">
		{#each data.done as i (i.id)}<li>{@render card(i)}</li>{/each}
	</ul>
{/if}
