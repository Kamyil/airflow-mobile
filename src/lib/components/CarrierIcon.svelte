<script lang="ts">
	import type { CarrierKind } from '$lib/types';
	import Package from '@lucide/svelte/icons/package';
	import Layers from '@lucide/svelte/icons/layers-2';

	let { kind, class: classes = 'size-5' }: { kind: CarrierKind; class?: string } = $props();
</script>

{#if kind === 'PARCEL'}
	<Package class={classes} />
{:else}
	<Layers class={classes} />
{/if}
