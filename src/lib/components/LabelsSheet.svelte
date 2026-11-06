<script lang="ts">
	import type { LabelDTO } from '$lib/types';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import LabelCard from './LabelCard.svelte';
	import Printer from '@lucide/svelte/icons/printer';
	import { plural } from '$lib/format';
	import CarrierCode from './CarrierCode.svelte';

	interface Props {
		open: boolean;
		labels: LabelDTO[];
		printer: string;
	}
	let { open = $bindable(), labels, printer }: Props = $props();

	let title = $derived(`Wydrukowano ${labels.length} ${plural(labels.length, 'etykietę', 'etykiety', 'etykiet')}`);
</script>

<Sheet bind:open {title} description="Naklej etykiety na odpowiednie nośniki." tall>
	<div class="mb-4 flex items-center gap-3 rounded-xl bg-bg px-3 py-2.5 text-sm">
		<Printer class="size-5 shrink-0 text-muted" />
		<span class="flex-1">{printer}</span>
	</div>
	<div class="flex flex-col gap-5">
		{#each labels as label (label.carrierId)}
			<div>
				<div class="mb-1.5 flex items-center justify-between text-xs text-muted">
					<span class="text-ink"><CarrierCode code={label.code} /> · {label.carrierName}</span>
					<span>{label.printCount > 1 ? 'duplikat' : ''}</span>
				</div>
				<LabelCard {label} />
			</div>
		{/each}
	</div>
	{#snippet footer()}
		<Button variant="primary" size="lg" onclick={() => (open = false)}>Gotowe</Button>
	{/snippet}
</Sheet>
