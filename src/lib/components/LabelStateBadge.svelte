<script lang="ts">
	import type { CarrierDTO } from '$lib/types';
	import Badge from './Badge.svelte';
	import TagOff from '@lucide/svelte/icons/circle-off';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	// Pokazujemy tylko problemy – poprawna etykieta nie potrzebuje oznaczenia
	let { carrier }: { carrier: CarrierDTO } = $props();
</script>

{#if !carrier.hasLabel}
	<Badge tone="bad"><TagOff />Bez etykiety</Badge>
{:else if carrier.contentLabelOutdated}
	<Badge tone="warn"><TriangleAlert />Etykieta do ponownego wydruku</Badge>
{/if}
