<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { fmtDayLong, todayStr } from '$lib/format';
	import PackageOpen from '@lucide/svelte/icons/package-open';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Truck from '@lucide/svelte/icons/truck';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';

	let { data } = $props();
	let c = $derived(data.context.counts);

	let tiles = $derived([
		{ href: '/dostawy/do-przyjecia', label: 'Dostawy', icon: PackageOpen, count: c.deliveries, hint: c.receiptsOpen ? `${c.receiptsOpen} PZ w trakcie` : 'Awizacje na dziś' },
		{ href: '/alokacja', label: 'Alokacja', icon: ArrowDownToLine, count: c.allocation, hint: 'Zlecenia MWS na półki' },
		{ href: '/przesuniecia', label: 'Przesunięcia', icon: ArrowLeftRight, count: c.transfers, hint: 'MM do realizacji' },
		{ href: '/kompletacja', label: 'Kompletacja', icon: ClipboardList, count: c.picking, hint: 'Zlecenia kompletacyjne' },
		{ href: '/wydania/do-wydania', label: 'Wydania', icon: Truck, count: c.dispatch, hint: 'Zamówienia do wydania' },
		{ href: '/inne', label: 'Inne operacje', icon: LayoutGrid, count: c.inventory, hint: 'Inwentaryzacja' }
	]);
</script>

<PageHeader title="Airflow Magazyn" subtitle="{fmtDayLong(todayStr())} · {data.operator.name}" />

<div class="grid grid-cols-2 gap-3 p-3">
	{#each tiles as t (t.href)}
		{@const Icon = t.icon}
		<a href={t.href} class="relative flex min-h-36 flex-col justify-between rounded-2xl bg-surface p-4 ring-1 ring-line active:scale-[0.98] active:bg-task-soft">
			<span class="grid size-12 place-items-center rounded-xl {t.count ? 'bg-task text-task-ink' : 'bg-bg text-ink-2'}"><Icon class="size-6" /></span>
			{#if t.count}<span class="absolute top-4 right-4 font-mono text-3xl leading-none font-extrabold tabular-nums">{t.count}</span>{/if}
			<span>
				<span class="block text-[17px] leading-tight font-extrabold">{t.label}</span>
				<span class="mt-0.5 block text-xs text-muted">{t.hint}</span>
			</span>
		</a>
	{/each}
</div>
