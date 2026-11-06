<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SegmentTabs from '$lib/components/SegmentTabs.svelte';
	import Button from '$lib/components/Button.svelte';
	import Plus from '@lucide/svelte/icons/plus';

	let { data, children } = $props();
	let tabs = $derived([
		{ href: '/przesuniecia', label: 'Do realizacji', count: data.context.counts.transfers },
		{ href: '/przesuniecia/zrealizowane', label: 'Zrealizowane' }
	]);
</script>

<PageHeader title="Przesunięcia" subtitle="MM w obrębie magazynu" back="/">
	{#snippet below()}<SegmentTabs {tabs} />{/snippet}
</PageHeader>

<div class="pb-20">{@render children()}</div>

<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
	<div class="pb-3"><Button variant="task" size="lg" class="w-full" href="/przesuniecia/nowe"><Plus class="size-5" />Nowe przesunięcie (MM)</Button></div>
</div>
