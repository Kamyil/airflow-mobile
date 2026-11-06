<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ApiError, loadCarrier, printShippingLabels, revertRelease, unloadCarrier, unloadOrder } from '$lib/api';
	import type { CarrierDTO, LabelDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDay, fmtKg, fmtTime } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import LabelsSheet from '$lib/components/LabelsSheet.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Printer from '@lucide/svelte/icons/printer';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Truck from '@lucide/svelte/icons/truck';

	let { data } = $props();
	let g = $derived(data.group);
	let busy = $state(false);
	let labels = $state<LabelDTO[]>([]);
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

	async function onScan(code: string): Promise<string | null> {
		try {
			let r = await loadCarrier(data.forwarderId, code);
			toast.ok(`Załadowano ${r.carrierCode}`, r.orderComplete ? `${r.orderNumber} – komplet` : r.orderNumber);
			if (r.allLoaded) toast.ok('Wszystkie gotowe nośniki załadowane', 'Możesz zakończyć wydanie.');
			await invalidateAll();
			return null;
		} catch (e) {
			if (e instanceof ApiError) return [e.message, ...e.details].join(' · ');
			throw e;
		}
	}

	let hints = $derived(
		(g?.orders ?? [])
			.filter((o) => o.ready)
			.flatMap((o) => o.pickingOrders.flatMap((p) => p.carriers))
			.filter((c) => !c.loadedAt)
			.slice(0, 2)
			.flatMap((c) => [{ code: c.code }, { code: c.code.slice(-5), label: `${c.code.slice(-5)} (końcówka)` }])
	);
</script>

<PageHeader title={g ? `Wydanie – ${g.forwarder.name}` : 'Wydanie'} subtitle={g?.dock} back="/wydania/do-wydania" />

{#if !g}
	<div class="p-3"><Empty>Brak zamówień do wydania dla tego spedytora.</Empty></div>
{:else}
	<div class="flex flex-col gap-3 p-3 pb-28">
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="flex items-center gap-2 text-sm font-bold"><Truck class="size-5 text-muted" />Załadunek na auto {g.forwarder.name}</p>
			<div class="mt-2"><Progress value={g.carriersLoaded} max={g.carriersReady} label="{g.carriersLoaded}/{g.carriersReady} nośn." /></div>
			<div class="mt-3"><ScanInput placeholder="Kod nośnika (lub 5 ostatnich cyfr)" {onScan} {hints} autofocus={false} /></div>
		</section>

		{#each g.orders as o (o.salesOrder.id)}
			{@const released = o.pickingOrders.filter((p) => p.released)}
			{@const carriers = released.flatMap((p) => p.carriers)}
			{@const unprinted = carriers.filter((c) => !c.stagedAt)}
			{@const complete = o.ready && o.carriersLoaded === o.carriersTotal}
			<article class="overflow-hidden rounded-2xl border bg-surface {complete ? 'border-ok/60' : 'border-line'}">
				<header class="p-4 pb-3">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="font-mono text-[15px] font-bold">{o.salesOrder.number}</p>
							<p class="truncate font-semibold text-ink-2">{o.customer.name}</p>
							<p class="text-xs text-muted">{o.customer.city} · termin {fmtDay(o.salesOrder.shipDate)} · {fmtKg(o.weightKg)}</p>
						</div>
						{#if complete}<Badge tone="ok"><CircleCheck />Załadowane</Badge>
						{:else if o.ready}<Badge tone="task">{o.carriersLoaded}/{o.carriersTotal} na aucie</Badge>
						{:else}<Badge tone="warn"><Hourglass />Przygotowanie</Badge>{/if}
					</div>
				</header>

				{#if o.waitingFor.length}
					<div class="mx-3 mb-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
						<p class="flex items-center gap-2 font-bold"><Hourglass class="size-4" />Czeka na kompletację</p>
						<ul class="mt-1 flex flex-col gap-0.5">
							{#each o.pickingOrders.filter((p) => !p.released) as p (p.id)}
								<li class="flex justify-between"><a href="/kompletacja/{p.id}" class="font-mono font-bold underline underline-offset-2">{p.number}</a><span class="text-xs font-bold">{p.progress.linesDone}/{p.progress.lines} poz.</span></li>
							{/each}
						</ul>
					</div>
				{/if}

				{#each released as p (p.id)}
					<section class="border-t border-line">
						<div class="flex items-center justify-between bg-bg/70 px-4 py-1.5">
							<span class="font-mono text-xs font-bold text-muted">{p.number}</span>
							{#if !p.carriers.some((c) => c.loadedAt)}
								<button type="button" class="flex items-center gap-1 text-xs font-bold text-muted hover:text-ink" disabled={busy} onclick={() => confirm(`Cofnąć wydanie ${p.number}? Zlecenie wróci do kompletacji.`) && run(() => revertRelease(p.id))}><Undo2 class="size-3.5" />Cofnij wydanie</button>
							{/if}
						</div>
						<ul>
							{#each p.carriers as c (c.id)}
								<li class="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-0">
									<span class="grid size-7 shrink-0 place-items-center rounded-full {c.loadedAt ? 'bg-ok text-white' : c.stagedAt ? 'bg-bg text-muted' : 'bg-bad-soft text-bad'}">
										{#if c.loadedAt}<Check class="size-4" strokeWidth={3} />{:else if c.stagedAt}<Truck class="size-3.5" />{:else}<Printer class="size-3.5" />{/if}
									</span>
									<div class="min-w-0 flex-1">
										<CarrierCode code={c.code} class="block text-[15px] {c.loadedAt ? 'text-ok' : ''}" />
										<p class="truncate text-xs text-muted">{c.name} · {fmtKg(c.weightKg)}{c.loadedAt ? ` · załadowano ${fmtTime(c.loadedAt)}` : c.stagedAt ? ' · na DOKu' : ''}</p>
									</div>
									{#if c.loadedAt}
										<button type="button" class="text-xs font-bold text-muted underline" disabled={busy} onclick={() => run(() => unloadCarrier(c.id))}>cofnij</button>
									{:else if !c.stagedAt}
										<Button size="sm" disabled={busy} onclick={() => print([c])}>Etykieta</Button>
									{:else if o.ready}
										<Button size="sm" disabled={busy} onclick={() => onScan(c.code).then((err) => err && toast.warn(err))}>Załaduj</Button>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}

				{#if unprinted.length > 1 || (o.carriersLoaded > 0 && !complete)}
					<footer class="border-t border-line bg-bg/60 p-2">
						{#if unprinted.length > 1}
							<Button variant="primary" class="w-full" loading={busy} onclick={() => print(unprinted)}><Printer class="size-4" />Drukuj etykiety wysyłkowe ({unprinted.length})</Button>
						{:else}
							<Button class="w-full" disabled={busy} onclick={() => run(() => unloadOrder(o.salesOrder.id))}><Undo2 class="size-4" />Cofnij załadunek zamówienia (nie jedzie)</Button>
						{/if}
					</footer>
				{/if}
			</article>
		{/each}
	</div>

	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3">
			{#if g.partialOrders.length}<p class="mb-2 flex items-center gap-1.5 text-xs font-bold text-warn"><TriangleAlert class="size-4" />Dokończ albo cofnij: {g.partialOrders.join(', ')}</p>{/if}
			<Button variant="ok" size="lg" class="w-full" disabled={!g.loadedOrders || g.partialOrders.length > 0} href={g.loadedOrders && !g.partialOrders.length ? `/wydania/${g.forwarder.id}/finalizacja` : undefined}>
				Zakończ wydanie ({g.loadedOrders} zam.)<ArrowRight class="size-5" />
			</Button>
		</div>
	</div>
{/if}

<LabelsSheet bind:open={labelsOpen} {labels} printer={data.context.operator.printer} />
