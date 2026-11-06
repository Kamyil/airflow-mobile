<script lang="ts">
	import { page } from '$app/state';
	import { setParams } from '$lib/url';
	import { fmtKg } from '$lib/format';
	import ChipSelect from '$lib/components/ChipSelect.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();
	let docks = $derived(data.context.refs.docks.filter((d) => d.purpose !== 'IN'));
</script>

<div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3">
	<ChipSelect label="DOK" value={page.url.searchParams.get('dok')} options={docks.map((d) => ({ value: d.name, label: d.name }))} onChange={(v) => setParams({ dok: v })} />
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each data.groups as g (g.forwarder.id)}
		{@const notReady = g.orders.length - g.readyOrders}
		<li>
			<a href="/wydania/{g.forwarder.id}" class="block overflow-hidden rounded-2xl border border-line bg-surface active:bg-bg">
				<header class="flex items-center gap-3 bg-ink px-4 py-3 text-white">
					<CarrierIcon kind={g.forwarder.kind} class="size-6" />
					<div class="flex-1">
						<p class="text-lg leading-tight font-extrabold">{g.forwarder.name}</p>
						<p class="flex items-center gap-1 text-xs text-white/70"><Warehouse class="size-3.5" />{g.dock}</p>
					</div>
					<ChevronRight class="size-5 text-white/60" />
				</header>
				<div class="p-4">
					<div class="flex flex-wrap gap-1.5">
						<Badge tone={g.readyOrders ? 'ok' : 'neutral'}>{g.readyOrders}/{g.orders.length} zam. gotowych</Badge>
						{#if g.loadedOrders}<Badge tone="task">{g.loadedOrders} załadowane · {fmtKg(g.weightLoadedKg)}</Badge>{/if}
						{#if notReady}<Badge tone="warn"><Hourglass />{notReady} w przygotowaniu</Badge>{/if}
					</div>
					{#if g.carriersReady}<div class="mt-3"><Progress value={g.carriersLoaded} max={g.carriersReady} label="załadowano {g.carriersLoaded}/{g.carriersReady} nośn." /></div>{/if}
					{#if g.partialOrders.length}<p class="mt-2 flex items-center gap-1.5 text-xs font-bold text-warn"><TriangleAlert class="size-3.5" />Częściowo: {g.partialOrders.join(', ')}</p>{/if}
					<ul class="mt-2 flex flex-col gap-0.5 text-xs text-muted">
						{#each g.orders as o (o.salesOrder.id)}<li class="truncate"><b class="font-mono text-ink-2">{o.salesOrder.number}</b> · {o.customer.name}</li>{/each}
					</ul>
				</div>
			</a>
		</li>
	{:else}
		<li><Empty>Brak zamówień do wydania. Wydane kompletacje pojawią się tutaj.</Empty></li>
	{/each}
</ul>
