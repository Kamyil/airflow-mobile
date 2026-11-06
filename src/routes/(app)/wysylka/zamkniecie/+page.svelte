<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { closeDay } from '$lib/api';
	import type { Forwarder, OrderReadiness } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDateTime, fmtDay, fmtKg, plural } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import FileText from '@lucide/svelte/icons/file-text';
	import Lock from '@lucide/svelte/icons/lock';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();

	// grupowanie po spedytorze (podgląd tylko do odczytu)
	let groups = $derived.by(() => {
		let map = new Map<string, { forwarder: Forwarder; orders: OrderReadiness[] }>();
		for (let o of data.orders) {
			if (!map.has(o.forwarder.id)) map.set(o.forwarder.id, { forwarder: o.forwarder, orders: [] });
			map.get(o.forwarder.id)!.orders.push(o);
		}
		return [...map.values()];
	});

	let ready = $derived(data.orders.filter((o) => o.ready));
	let notReady = $derived(data.orders.filter((o) => !o.ready));

	let confirmOpen = $state(false);
	let busy = $state(false);

	async function close() {
		busy = true;
		try {
			let shipments = await closeDay();
			toast.ok('Dzień zamknięty', shipments.map((s) => `${s.forwarder.name}: ${s.number}`).join(' · '));
			confirmOpen = false;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4 p-3 pb-24">
	{#each groups as group (group.forwarder.id)}
		{@const readyCount = group.orders.filter((o) => o.ready).length}
		<section class="overflow-hidden rounded-2xl border border-line bg-surface">
			<header class="flex items-center gap-3 bg-ink px-4 py-3 text-white">
				<CarrierIcon kind={group.forwarder.kind} class="size-6" />
				<div class="flex-1">
					<p class="text-lg leading-tight font-extrabold">{group.forwarder.name}</p>
					<p class="flex items-center gap-1 text-xs text-white/70"><Warehouse class="size-3.5" />{group.forwarder.defaultDock}</p>
				</div>
				<Badge tone={readyCount ? 'task' : 'neutral'} class={readyCount ? '' : 'bg-white/15 text-white'}>{readyCount}/{group.orders.length} gotowe</Badge>
			</header>
			<ul>
				{#each group.orders as o (o.salesOrder.id)}
					<li class="border-t border-line px-4 py-3 first:border-0">
						<div class="flex items-baseline justify-between gap-2">
							<p class="font-mono text-sm font-bold">{o.salesOrder.number}</p>
							<p class="text-xs text-muted">{fmtKg(o.weightKg)} · termin {fmtDay(o.salesOrder.shipDate)}</p>
						</div>
						<p class="truncate text-sm text-ink-2">{o.customer.name}</p>
						{#if !o.ready}
							<p class="mt-1 flex items-center gap-1 text-xs font-semibold text-warn">
								<Hourglass class="size-3.5" />
								{o.waitingFor.length ? `Czeka na: ${o.waitingFor.join(', ')}` : `Wydrukowane etykiety ${o.carriersStaged}/${o.carriersTotal}`}
							</p>
						{/if}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each o.pickingOrders.flatMap((p) => p.carriers) as c (c.id)}
								<span class="inline-flex h-7 items-center rounded-lg border border-line bg-bg px-2 text-xs"><CarrierCode code={c.code} /></span>
							{/each}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<div class="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">Brak zamówień do wysłania</div>
	{/each}

	{#if data.shipments.length}
		<section>
			<h2 class="mt-2 mb-2 px-1 text-sm font-extrabold tracking-wide text-muted uppercase">Zamknięte wysyłki</h2>
			<ul class="flex flex-col gap-2">
				{#each data.shipments as s (s.id)}
					<li class="rounded-2xl border border-line bg-surface p-4">
						<div class="flex items-baseline justify-between gap-2">
							<p class="font-mono font-bold">{s.number}</p>
							<p class="text-sm text-muted">{fmtDateTime(s.closedAt)}</p>
						</div>
						<p class="mt-1 text-sm"><b>{s.forwarder.name}</b> · {s.carriers} nośn. · {fmtKg(s.weightKg)}</p>
						<p class="mt-1 flex items-center gap-1.5 text-sm"><FileText class="size-4 text-muted" />List przewozowy <b class="font-mono">{s.waybillNo}</b></p>
						<ul class="mt-2 flex flex-col gap-0.5 text-xs text-muted">
							{#each s.orders as o}<li><span class="font-mono font-bold text-ink-2">{o.number}</span> · {o.customer}</li>{/each}
						</ul>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<div class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 py-3 backdrop-blur">
	<Button variant="primary" size="lg" class="w-full" disabled={ready.length === 0} onclick={() => (confirmOpen = true)}><Lock class="size-5" />Zamknij dzień</Button>
</div>

<Sheet bind:open={confirmOpen} title="Zamknąć dzień?" description="Gotowe zamówienia zostaną wysłane – powstanie jedna wysyłka na spedytora.">
	<ul class="divide-y divide-line rounded-xl border border-line text-sm">
		{#each groups.filter((g) => g.orders.some((o) => o.ready)) as g (g.forwarder.id)}
			{@const orders = g.orders.filter((o) => o.ready)}
			<li class="flex items-center justify-between gap-2 px-3 py-2.5">
				<span class="flex items-center gap-2 font-bold"><CarrierIcon kind={g.forwarder.kind} class="size-4" />{g.forwarder.name}</span>
				<span class="text-muted">{orders.length} zam. · {orders.reduce((n, o) => n + o.carriersTotal, 0)} nośn.</span>
			</li>
		{/each}
	</ul>
	{#if notReady.length}
		<p class="mt-3 flex gap-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">
			<TriangleAlert class="size-5 shrink-0" />{notReady.length} {plural(notReady.length, 'zamówienie nie jest gotowe', 'zamówienia nie są gotowe', 'zamówień nie jest gotowych')} i zostanie na kolejny dzień.
		</p>
	{/if}
	{#snippet footer()}
		<Button variant="primary" size="lg" loading={busy} onclick={close}><Lock class="size-5" />Zamknij dzień</Button>
		<Button variant="ghost" onclick={() => (confirmOpen = false)}>Anuluj</Button>
	{/snippet}
</Sheet>
