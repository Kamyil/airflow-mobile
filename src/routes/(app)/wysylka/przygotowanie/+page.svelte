<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { printShippingLabels, revertRelease } from '$lib/api';
	import type { CarrierDTO, LabelDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDay, fmtKg, fmtTime } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import LabelsSheet from '$lib/components/LabelsSheet.svelte';
	import X from '@lucide/svelte/icons/x';
	import Filter from '@lucide/svelte/icons/filter';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Printer from '@lucide/svelte/icons/printer';

	let { data } = $props();

	let busy = $state(false);
	let labels: LabelDTO[] = $state([]);
	let labelsOpen = $state(false);

	async function run(fn: () => Promise<void>) {
		busy = true;
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	function print(carriers: CarrierDTO[]) {
		run(async () => {
			labels = await printShippingLabels(carriers.map((c) => c.id));
			labelsOpen = true;
		});
	}

	function undo(po: { id: string; number: string }) {
		if (!confirm(`Cofnąć wydanie ${po.number}? Zlecenie wróci do kompletacji.`)) return;
		run(async () => {
			await revertRelease(po.id);
			toast.info(`Cofnięto wydanie ${po.number}`);
		});
	}
</script>

<div class="flex flex-col gap-3 p-3">
	{#if data.salesOrderNumber}
		<div class="flex items-center gap-2">
			<span class="inline-flex h-9 items-center gap-2 rounded-full bg-ink pr-1 pl-3 text-sm font-bold text-white">
				<Filter class="size-4" />Zamówienie: <span class="font-mono">{data.salesOrderNumber}</span>
				<a href="/wysylka/przygotowanie" class="grid size-7 place-items-center rounded-full bg-white/15" aria-label="Usuń filtr"><X class="size-4" /></a>
			</span>
		</div>
	{/if}

	{#each data.orders as order (order.salesOrder.id)}
		{@const released = order.pickingOrders.filter((p) => p.released)}
		{@const waiting = order.pickingOrders.filter((p) => !p.released)}
		{@const unprinted = released.flatMap((p) => p.carriers).filter((c) => !c.stagedAt)}
		<article class="overflow-hidden rounded-2xl border bg-surface {order.ready ? 'border-ok/50' : 'border-line'}">
			<header class="p-4 pb-3">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-mono text-[15px] font-bold">{order.salesOrder.number}</p>
						<p class="truncate font-semibold text-ink-2">{order.customer.name}</p>
					</div>
					{#if order.ready}
						<Badge tone="ok"><CircleCheck />Gotowe</Badge>
					{:else}
						<Badge tone="neutral">{order.carriersStaged}/{order.carriersTotal} wydrukowane</Badge>
					{/if}
				</div>
				<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
					<span class="flex items-center gap-1"><CarrierIcon kind={order.forwarder.kind} class="size-4" /><b class="text-ink">{order.forwarder.name}</b></span>
					<span class="flex items-center gap-1"><Warehouse class="size-4" />{order.forwarder.defaultDock}</span>
					<span>Termin <b class="text-ink">{fmtDay(order.salesOrder.shipDate)}</b></span>
					<span>{fmtKg(order.weightKg)}</span>
				</div>
			</header>

			{#if waiting.length}
				<div class="mx-3 mb-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
					<p class="flex items-center gap-2 font-bold"><Hourglass class="size-4" />Czeka na kompletację</p>
					<ul class="mt-1.5 flex flex-col gap-1">
						{#each waiting as p}
							<li class="flex items-center justify-between gap-2">
								<a href="/kompletacja/{p.id}" class="font-mono font-bold underline underline-offset-2">{p.number}</a>
								<span class="text-xs font-bold">{p.progress.linesDone}/{p.progress.lines} poz.</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#each released as p (p.id)}
				<section class="border-t border-line">
					<div class="flex items-center justify-between bg-bg/70 px-4 py-1.5">
						<span class="font-mono text-xs font-bold text-muted">{p.number}</span>
						<button type="button" class="flex items-center gap-1 text-xs font-bold text-muted hover:text-ink" disabled={busy} onclick={() => undo(p)}>
							<Undo2 class="size-3.5" />Cofnij wydanie
						</button>
					</div>
					<ul>
						{#each p.carriers as c (c.id)}
							<li class="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-0">
								<div class="min-w-0 flex-1">
									<CarrierCode code={c.code} class="block text-[15px] {c.stagedAt ? 'text-ok' : ''}" />
									<p class="truncate text-xs text-muted">{c.name} · {fmtKg(c.weightKg)}</p>
								</div>
								{#if c.stagedAt}
									<span class="text-right text-xs">
										<b class="block text-ok">Wydrukowano</b>
										<span class="text-muted">{fmtTime(c.stagedAt)}</span>
									</span>
									<button type="button" class="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Drukuj ponownie" disabled={busy} onclick={() => print([c])}>
										<Printer class="size-4" />
									</button>
								{:else}
									<Button size="sm" disabled={busy} onclick={() => print([c])}>Drukuj etykietę</Button>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			<footer class="border-t border-line bg-bg/60 p-2">
				{#if order.ready}
					<Button variant="ok" size="lg" class="w-full" href="/wysylka/zamkniecie">Do zamknięcia wysyłki<ArrowRight class="size-5" /></Button>
				{:else if unprinted.length}
					<Button variant="primary" size="lg" class="w-full" loading={busy} onclick={() => print(unprinted)}>
						<Printer class="size-5" />{unprinted.length === 1 ? 'Drukuj etykietę' : `Drukuj etykiety (${unprinted.length})`}
					</Button>
				{:else}
					<p class="py-2 text-center text-sm text-muted">Etykiety wydrukowane – czeka na pozostałe kompletacje</p>
				{/if}
			</footer>
		</article>
	{:else}
		<div class="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">
			{data.salesOrderNumber ? `Brak wydanych kompletacji dla ${data.salesOrderNumber}` : 'Brak wydanych kompletacji do przygotowania'}
		</div>
	{/each}
</div>

<LabelsSheet bind:open={labelsOpen} {labels} printer={data.context.operator.printer} />
