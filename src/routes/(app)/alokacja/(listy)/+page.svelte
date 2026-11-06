<script lang="ts">
	import AllocationList from './AllocationList.svelte';
	let { data } = $props();
</script>

<AllocationList orders={data.orders} refs={data.context.refs} empty="Brak zleceń do alokacji – wszystko na półkach" />
