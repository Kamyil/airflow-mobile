<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SegmentTabs from '$lib/components/SegmentTabs.svelte';

	let { data, children } = $props();
	let tabs = $derived([
		{ href: '/dostawy/do-przyjecia', label: 'Do przyjęcia', count: data.context.counts.deliveries },
		{ href: '/dostawy/w-trakcie', label: 'W trakcie', count: data.context.counts.receiptsOpen },
		{ href: '/dostawy/przyjete', label: 'Przyjęte' }
	]);
</script>

<PageHeader title="Dostawy" subtitle="Awizacje i przyjęcia (PZ)" back="/">
	{#snippet below()}<SegmentTabs {tabs} />{/snippet}
</PageHeader>

{@render children()}
