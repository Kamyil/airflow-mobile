<script lang="ts">
	import JsBarcode from 'jsbarcode';
	import type { LabelDTO } from '$lib/types';
	import { fmtDay, fmtKg } from '$lib/format';

	let { label }: { label: LabelDTO } = $props();

	function barcode(node: SVGSVGElement, value: string) {
		const draw = (v: string) => JsBarcode(node, v, { format: 'CODE128', displayValue: false, height: 64, margin: 0, width: 2 });
		draw(value);
		return { update: draw };
	}
</script>

<!-- Podgląd etykiety logistycznej ~ 100×150 mm -->
<article class="overflow-hidden rounded-lg border-2 border-ink bg-white font-mono text-[11px] leading-snug text-black shadow-sm">
	<div class="grid grid-cols-2 border-b-2 border-ink">
		<div class="border-r-2 border-ink p-2">
			<p class="text-[9px] uppercase opacity-60">Nadawca</p>
			<p class="font-bold">MWS Magazyn Centralny</p>
			<p>ul. Logistyczna 1, 62-080 Tarnowo P.</p>
		</div>
		<div class="p-2">
			<p class="text-[9px] uppercase opacity-60">Spedytor</p>
			<p class="text-base font-extrabold">{label.forwarder.name.toUpperCase()}</p>
			<p>Termin: {fmtDay(label.shipDate)} ({label.shipDate})</p>
		</div>
	</div>
	<div class="border-b-2 border-ink p-2">
		<p class="text-[9px] uppercase opacity-60">Odbiorca</p>
		<p class="text-[13px] font-extrabold">{label.customer.name}</p>
		<p>{label.customer.street}, {label.customer.postalCode} {label.customer.city}</p>
	</div>
	<div class="grid grid-cols-[1fr_auto] border-b-2 border-ink">
		<div class="border-r-2 border-ink p-2">
			<p>Zam.: <b>{label.salesOrderNumber}</b></p>
			<p>Zam. klienta: <b>{label.customerOrderNumber}</b></p>
			<p>ZK: {label.pickingOrderNumber}</p>
			<p>{label.carrierName} · {label.dimensions} · {fmtKg(label.weightKg)}</p>
		</div>
		<div class="grid min-w-24 place-items-center p-2 text-center">
			<p class="text-[9px] uppercase opacity-60">Nośnik</p>
			<p class="text-3xl leading-none font-extrabold">{label.no}<span class="text-lg">/{label.of}</span></p>
		</div>
	</div>
	<div class="p-2 text-center">
		<p class="text-left text-[9px] uppercase opacity-60">Kod nośnika</p>
		<svg use:barcode={label.code} class="mx-auto h-16 w-full"></svg>
		<p class="mt-1 text-base font-extrabold tracking-wider">{label.code}</p>
	</div>
	{#if label.withContent}
		<div class="border-t-2 border-ink p-2">
			<p class="mb-1 text-[9px] uppercase opacity-60">Zawartość ({label.items.length} poz.)</p>
			<table class="w-full">
				<tbody>
					{#each label.items as item}
						<tr class="border-t border-black/15 first:border-0">
							<td class="py-0.5 pr-2 align-top font-bold whitespace-nowrap">{item.sku}</td>
							<td class="py-0.5 pr-2 align-top font-sans">{item.name}</td>
							<td class="py-0.5 text-right align-top font-bold whitespace-nowrap">{item.qty} {item.unit}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</article>
