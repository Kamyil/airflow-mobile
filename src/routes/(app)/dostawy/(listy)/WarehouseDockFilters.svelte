<script lang="ts">
	import { page } from '$app/state';
	import ChipSelect from '$lib/components/ChipSelect.svelte';
	import { setParams } from '$lib/url';
	import type { RefsDTO } from '$lib/types';

	/** Wspólne filtry list dostaw: magazyn + DOK (DOKi zawężone do wybranego magazynu) */
	let { refs }: { refs: RefsDTO } = $props();

	let mg = $derived(page.url.searchParams.get('mg'));
	let dok = $derived(page.url.searchParams.get('dok'));
	let docks = $derived(refs.docks.filter((d) => d.purpose !== 'OUT' && (!mg || d.warehouseId === mg)));
</script>

<ChipSelect
	label="Magazyn"
	value={mg}
	options={refs.warehouses.map((w) => ({ value: w.id, label: w.code, hint: `${w.name}, ${w.city}` }))}
	onChange={(v) => setParams({ mg: v, dok: null })}
/>
<ChipSelect
	label="DOK"
	value={dok}
	options={docks.map((d) => ({ value: d.id, label: d.name, hint: refs.warehouses.find((w) => w.id === d.warehouseId)?.code }))}
	onChange={(v) => setParams({ dok: v })}
/>
