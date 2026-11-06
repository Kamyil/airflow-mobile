<script lang="ts">
	import Empty from '$lib/components/Empty.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import WarehouseDockFilters from '../WarehouseDockFilters.svelte';
	import ReceiptCard from '../ReceiptCard.svelte';

	let { data } = $props();
	let q = $state('');
	let visible = $derived(
		data.receipts.filter((r) => {
			let s = q.trim().toLowerCase();
			return !s || [r.number, r.supplier.name, r.advice.number, r.advice.vehicle.plate, ...r.purchaseOrders.map((p) => p.number)].some((v) => v.toLowerCase().includes(s));
		})
	);
</script>

<div class="flex flex-col gap-2.5 px-3 pt-3">
	<div class="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3"><WarehouseDockFilters refs={data.context.refs} /></div>
	<SearchBox bind:value={q} placeholder="Nr PZ, dostawca, ZZ…" />
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each visible as r (r.id)}
		<li><ReceiptCard {r} /></li>
	{:else}
		<li><Empty>Brak PZ w trakcie przyjmowania</Empty></li>
	{/each}
</ul>
