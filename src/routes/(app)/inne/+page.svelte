<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import FilePlus2 from '@lucide/svelte/icons/file-plus-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { data } = $props();
	let ops = $derived([
		{ href: '/inne/inwentaryzacja', label: 'Inwentaryzacja', hint: 'Liczenie lokalizacji ze stanem systemowym', icon: ClipboardCheck, count: data.context.counts.inventory },
		{ href: '/przesuniecia/nowe', label: 'Nowy dokument MM', hint: 'Przesunięcie towaru między lokalizacjami', icon: FilePlus2, count: 0 }
	]);
</script>

<PageHeader title="Inne operacje" back="/" />

<ul class="flex flex-col gap-3 p-3">
	{#each ops as o (o.href)}
		{@const Icon = o.icon}
		<li>
			<a href={o.href} class="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line active:bg-task-soft">
				<span class="grid size-12 shrink-0 place-items-center rounded-xl {o.count ? 'bg-task text-task-ink' : 'bg-bg'}"><Icon class="size-6" /></span>
				<span class="min-w-0 flex-1"><b class="block text-[17px]">{o.label}</b><span class="text-xs text-muted">{o.hint}</span></span>
				{#if o.count}<span class="font-mono text-2xl font-extrabold">{o.count}</span>{/if}
				<ChevronRight class="size-5 text-muted" />
			</a>
		</li>
	{/each}
</ul>
