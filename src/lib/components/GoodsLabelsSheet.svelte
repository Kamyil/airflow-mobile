<script lang="ts">
	import JsBarcode from 'jsbarcode';
	import type { GoodsLabelDTO } from '$lib/types';
	import { fmtDate } from '$lib/format';
	import { plural } from '$lib/format';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import Printer from '@lucide/svelte/icons/printer';

	/** Podgląd wydrukowanych etykiet towarowych (przyjęcie) */
	let { open = $bindable(), labels, printer }: { open: boolean; labels: GoodsLabelDTO[]; printer: string } = $props();

	function barcode(value: string) {
		return (node: SVGSVGElement) => {
			JsBarcode(node, value, { format: 'CODE128', displayValue: false, height: 48, margin: 0, width: 1.6 });
		};
	}
</script>

<Sheet bind:open title="Wydrukowano {labels.length} {plural(labels.length, 'etykietę', 'etykiety', 'etykiet')}" description="Naklej etykiety na opakowania przed alokacją." tall>
	<div class="mb-4 flex items-center gap-3 rounded-xl bg-bg px-3 py-2.5 text-sm"><Printer class="size-5 shrink-0 text-muted" />{printer}</div>
	<div class="flex flex-col gap-4">
		{#each labels as l (l.id)}
			<article class="overflow-hidden rounded-lg border-2 border-ink bg-white p-2 font-mono text-[11px] leading-snug text-black">
				<div class="flex items-start justify-between gap-2 border-b-2 border-ink pb-1.5">
					<div class="min-w-0">
						<p class="text-[13px] font-extrabold">{l.product.sku}</p>
						<p class="font-sans">{l.product.name}</p>
					</div>
					<p class="text-right text-xl font-extrabold whitespace-nowrap">{l.qty} <span class="text-xs">{l.product.unit}</span></p>
				</div>
				<div class="grid grid-cols-2 gap-x-2 py-1.5">
					<p>PZ: <b>{l.receiptNumber}</b></p>
					<p>Miejsce: <b>{l.location}</b></p>
					{#if l.batch}<p>Seria: <b>{l.batch}</b></p>{/if}
					{#if l.expiry}<p>Ważne do: <b>{fmtDate(l.expiry)}</b></p>{/if}
					{#if l.serial}<p class="col-span-2">SN: <b>{l.serial}</b></p>{/if}
					<p class="col-span-2 truncate">Dostawca: {l.supplier}</p>
				</div>
				<svg {@attach barcode(l.serial ?? l.product.ean)} class="h-12 w-full"></svg>
				<p class="text-center font-bold tracking-wider">{l.serial ?? l.product.ean}</p>
			</article>
		{/each}
	</div>
	{#snippet footer()}
		<Button variant="primary" size="lg" onclick={() => (open = false)}>Gotowe</Button>
	{/snippet}
</Sheet>
