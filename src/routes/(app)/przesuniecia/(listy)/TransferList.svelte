<script lang="ts">
	import { page } from '$app/state';
	import type { RefsDTO, TransferDTO, TransferSource } from '$lib/types';
	import { setParams } from '$lib/url';
	import { fmtDateTime } from '$lib/format';
	import Badge from '$lib/components/Badge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ChipSelect from '$lib/components/ChipSelect.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import WarehouseFilter from '$lib/components/WarehouseFilter.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let { transfers, refs, empty }: { transfers: TransferDTO[]; refs: RefsDTO; empty: string } = $props();
	const SOURCES: { value: TransferSource; label: string; hint: string }[] = [
		{ value: 'ERP', label: 'Z ERP (biuro)', hint: 'Zlecone przez biuro' },
		{ value: 'MWS', label: 'Z MWS (automat)', hint: 'Uzupełnienia wg progów min/max' },
		{ value: 'APP', label: 'Z apki', hint: 'Utworzone przez magazyniera' }
	];
	const STATUS = { DRAFT: 'Szkic', TODO: 'Do realizacji', IN_PROGRESS: 'W trakcie', DONE: 'Zrealizowane' } as const;
</script>

<div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3">
	<WarehouseFilter {refs} />
	<ChipSelect label="Źródło" value={page.url.searchParams.get('zrodlo') as TransferSource | null} options={SOURCES} onChange={(v) => setParams({ zrodlo: v })} />
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each transfers as t (t.id)}
		<li>
			<a href="/przesuniecia/{t.id}" class="block rounded-2xl border border-line bg-surface p-4 active:bg-bg">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-mono text-[15px] font-bold">{t.number}</p>
						<p class="text-sm font-semibold text-ink-2">{t.reason}</p>
					</div>
					<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
				</div>
				<div class="mt-2 flex flex-wrap gap-1.5">
					<StatusBadge status={t.source} />
					<StatusBadge status={t.status} label={STATUS[t.status]} />
					<Badge>{t.warehouse.code}</Badge>
				</div>
				<ul class="mt-2 flex flex-col gap-0.5 text-xs text-muted">
					{#each t.lines.slice(0, 3) as l (l.id)}
						<li class="flex items-center gap-1 truncate"><b class="font-mono text-ink-2">{l.fromLocation}</b><ArrowRight class="size-3" /><b class="font-mono text-ink-2">{l.toLocation ?? '?'}</b> · {l.qty} {l.product.unit} {l.product.sku}</li>
					{/each}
					{#if t.lines.length > 3}<li>+ {t.lines.length - 3} poz.</li>{/if}
				</ul>
				{#if t.status !== 'DONE' && t.status !== 'DRAFT'}<div class="mt-3"><Progress value={t.progress.linesDone} max={t.progress.lines} label="{t.progress.linesDone}/{t.progress.lines} poz." /></div>{/if}
				<p class="mt-2 text-xs text-muted">{t.createdBy} · {fmtDateTime(t.doneAt ?? t.createdAt)}</p>
			</a>
		</li>
	{:else}
		<li><Empty>{empty}</Empty></li>
	{/each}
</ul>
