<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SegmentTabs from '$lib/components/SegmentTabs.svelte';

	let { data, children } = $props();
	let tabs = $derived([
		{ href: '/alokacja', label: 'Do alokacji', count: data.context.counts.allocation },
		{ href: '/alokacja/zakonczone', label: 'Zakończone' }
	]);
</script>

<PageHeader title="Alokacja" subtitle="Zlecenia magazynowe MWS – z miejsca odstawczego na półki" back="/">
	{#snippet below()}<SegmentTabs {tabs} />{/snippet}
</PageHeader>

{@render children()}
