<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SegmentTabs from '$lib/components/SegmentTabs.svelte';

	let { data, children } = $props();
	let tabs = $derived([
		{ href: '/wydania/do-wydania', label: 'Do wydania', count: data.context.counts.dispatch },
		{ href: '/wydania/wydane', label: 'Wydane' }
	]);
</script>

<PageHeader title="Wydania" subtitle="Załadunek na DOKu" back="/">
	{#snippet below()}<SegmentTabs {tabs} />{/snippet}
</PageHeader>

{@render children()}
