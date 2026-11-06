<script lang="ts">
	import TransferList from './TransferList.svelte';
	let { data } = $props();
</script>

<TransferList transfers={data.transfers} refs={data.context.refs} empty="Brak przesunięć do realizacji" />
