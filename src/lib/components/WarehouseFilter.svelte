<script lang="ts">
	import { page } from '$app/state';
	import ChipSelect from './ChipSelect.svelte';
	import { setParams } from '$lib/url';
	import type { RefsDTO } from '$lib/types';

	let { refs }: { refs: RefsDTO } = $props();
	let mg = $derived(page.url.searchParams.get('mg'));
</script>

<ChipSelect label="Magazyn" value={mg} options={refs.warehouses.map((w) => ({ value: w.id, label: w.code, hint: `${w.name}, ${w.city}` }))} onChange={(v) => setParams({ mg: v })} />
