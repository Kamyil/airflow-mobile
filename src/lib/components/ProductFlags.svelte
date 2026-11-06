<script lang="ts">
	import type { Product, ProductFlags } from '$lib/types';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Layers from '@lucide/svelte/icons/layers';
	import Hash from '@lucide/svelte/icons/hash';

	/** Oznaczenia produktu pobierane z ERP: KJ (kontrola jakości), SERIA (partia), SN (numer seryjny) */
	let { product, flags, size = 'md' }: { product?: Product; flags?: ProductFlags; size?: 'sm' | 'md' } = $props();

	let f = $derived(flags ?? { qc: !!product?.requiresQc, batch: product?.tracking === 'BATCH', serial: product?.tracking === 'SERIAL' });
	let cls = $derived(size === 'sm' ? 'h-5 px-1.5 text-[10px] [&_svg]:size-3' : 'h-6 px-2 text-xs [&_svg]:size-3.5');
</script>

{#if f.qc}<span class="inline-flex items-center gap-1 rounded-md bg-bad text-white font-extrabold {cls}" title="Wymaga kontroli jakości"><ShieldAlert />KJ</span>{/if}
{#if f.batch}<span class="inline-flex items-center gap-1 rounded-md bg-info-soft text-info font-extrabold {cls}" title="Wymaga numeru serii / partii"><Layers />SERIA</span>{/if}
{#if f.serial}<span class="inline-flex items-center gap-1 rounded-md bg-ink text-white font-extrabold {cls}" title="Wymaga numerów seryjnych"><Hash />SN</span>{/if}
