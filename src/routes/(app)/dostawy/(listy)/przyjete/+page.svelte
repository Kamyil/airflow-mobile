<script lang="ts">
	import DayPicker from '$lib/components/DayPicker.svelte';
	import { setParams } from '$lib/url';
	import { fmtDayLong } from '$lib/format';
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
	<DayPicker value={data.date} onChange={(d) => setParams({ dzien: d })} />
	<div class="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3"><WarehouseDockFilters refs={data.context.refs} /></div>
	<p class="px-1 text-xs text-muted">Zrealizowane PZ – {fmtDayLong(data.date)}: <b class="text-ink">{data.receipts.length}</b></p>
	<SearchBox bind:value={q} placeholder="Nr PZ, dostawca, ZZ…" />
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each visible as r (r.id)}
		<li><ReceiptCard {r} /></li>
	{:else}
		<li><Empty>Brak zrealizowanych PZ w tym dniu</Empty></li>
	{/each}
</ul>
