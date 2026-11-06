<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, printLabels, releasePickingOrder } from '$lib/api';
	import type { LabelDTO, PickingOrderSummaryDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { plural } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppMenu from '$lib/components/AppMenu.svelte';
	import Button from '$lib/components/Button.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import LabelsSheet from '$lib/components/LabelsSheet.svelte';
	import Search from '@lucide/svelte/icons/search';
	import Tag from '@lucide/svelte/icons/tag';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Printer from '@lucide/svelte/icons/printer';

	let { data } = $props();

	let search = $state('');
	let visible = $derived(
		data.pickingOrders.filter((po) => {
			let q = search.trim().toLowerCase();
			if (!q) return true;
			return [po.number, po.salesOrder.number, po.salesOrder.customerOrderNumber, po.customer.name].some((s) => s.toLowerCase().includes(q));
		})
	);

	let printer = $derived(data.context.operator.printer);
	let busyId = $state<string | null>(null);

	// --- wejście w kompletację: najpierw etykiety nośników ---
	let gateFor = $state<PickingOrderSummaryDTO | null>(null);
	let gateOpen = $state(false);

	function open(po: PickingOrderSummaryDTO) {
		if (po.carriersWithoutLabel > 0) {
			gateFor = po;
			gateOpen = true;
			return;
		}
		goto(`/kompletacja/${po.id}`);
	}

	async function printAndOpen() {
		if (!gateFor) return;
		busyId = gateFor.id;
		try {
			let ids = gateFor.carriers.filter((c) => !c.hasLabel).map((c) => c.id);
			await printLabels(ids, { withContent: false });
			toast.ok(`Wydrukowano ${ids.length} ${plural(ids.length, 'etykietę', 'etykiety', 'etykiet')}`, 'Naklej je na nośniki przed pakowaniem.');
			gateOpen = false;
			await goto(`/kompletacja/${gateFor.id}`);
		} catch (e) {
			toast.error(e);
		} finally {
			busyId = null;
		}
	}

	// --- generowanie etykiet (nośnik + zawartość) ---
	let labels: LabelDTO[] = $state([]);
	let labelsOpen = $state(false);

	async function generateLabels(po: PickingOrderSummaryDTO) {
		if (po.carriers.length === 0) {
			toast.warn('Brak nośników', 'Dodaj nośniki w kompletacji, aby wygenerować etykiety.');
			return;
		}
		busyId = po.id;
		try {
			labels = await printLabels(
				po.carriers.map((c) => c.id),
				{ withContent: true }
			);
			labelsOpen = true;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busyId = null;
		}
	}

	// --- wydanie ---
	let blocked = $state<{ po: PickingOrderSummaryDTO; blockers: string[] } | null>(null);
	let blockedOpen = $state(false);

	async function release(po: PickingOrderSummaryDTO) {
		busyId = po.id;
		try {
			let { salesOrderNumber } = await releasePickingOrder(po.id);
			toast.ok(`Wydano ${po.number}`, 'Wydrukuj etykiety w przygotowaniu wysyłki.');
			await goto(`/wysylka/przygotowanie?zamowienie=${encodeURIComponent(salesOrderNumber)}`);
		} catch (e) {
			if (e instanceof ApiError && e.code === 'RELEASE_BLOCKED') {
				blocked = { po, blockers: e.details };
				blockedOpen = true;
			} else toast.error(e);
		} finally {
			busyId = null;
		}
	}

	let blockedOnlyByLabels = $derived(blocked?.blockers.every((b) => b.startsWith('Etykiety')) ?? false);

	async function printMissingAndRelease() {
		if (!blocked) return;
		let po = blocked.po;
		blockedOpen = false;
		busyId = po.id;
		try {
			await printLabels(
				po.carriers.map((c) => c.id),
				{ withContent: true }
			);
			busyId = null;
			await release(po);
		} catch (e) {
			toast.error(e);
			busyId = null;
		}
	}
</script>

<PageHeader title="Kompletacja nośników" subtitle="Zatwierdzone zlecenia kompletacyjne">
	{#snippet actions()}<AppMenu />{/snippet}
</PageHeader>

<div class="px-3 pt-3">
	<label class="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-ink">
		<Search class="size-5 text-muted" />
		<input bind:value={search} class="h-full flex-1 bg-transparent outline-none" placeholder="Nr zamówienia, ZK, klient…" />
	</label>
</div>

<ul class="flex flex-col gap-3 p-3">
	{#each visible as po (po.id)}
		{@const done = po.progress.linesDone === po.progress.lines}
		<li class="overflow-hidden rounded-2xl border border-line bg-surface">
			<button type="button" class="block w-full p-4 pb-3 text-left active:bg-bg" onclick={() => open(po)}>
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="font-mono text-[15px] font-bold tracking-tight">{po.salesOrder.number}</p>
						<p class="mt-0.5 truncate text-[15px] font-semibold text-ink-2">{po.customer.name}</p>
						<p class="mt-0.5 font-mono text-xs text-muted">{po.number}</p>
					</div>
					<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
				</div>

				<div class="mt-3 flex items-center gap-3">
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
						<div class="h-full rounded-full {done ? 'bg-ok' : 'bg-task'}" style="width: {(po.progress.linesDone / po.progress.lines) * 100}%"></div>
					</div>
					<span class="text-xs font-bold tabular-nums">{po.progress.linesDone}/{po.progress.lines} poz.</span>
				</div>

				{#if po.carriers.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each po.carriers as c}
							<span class="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs {c.hasLabel ? 'border-line bg-bg' : 'border-bad/40 bg-bad-soft text-bad'}">
								<CarrierCode code={c.code} />
								{#if c.contentLabelOutdated}<TriangleAlert class="size-3.5 text-warn" />{/if}
							</span>
						{/each}
					</div>
				{/if}
			</button>

			<div class="grid grid-cols-2 gap-2 border-t border-line bg-bg/60 p-2">
				<Button disabled={busyId === po.id} onclick={() => generateLabels(po)}><Tag class="size-4" />Etykiety</Button>
				<Button variant={done ? 'ok' : 'primary'} loading={busyId === po.id} onclick={() => release(po)}>Wydaj<ArrowRight class="size-4" /></Button>
			</div>
		</li>
	{:else}
		<li class="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">Brak zleceń</li>
	{/each}
</ul>

<!-- Bramka: nośniki bez etykiet -->
<Sheet bind:open={gateOpen} title="Najpierw etykiety nośników" description="Zanim zaczniesz pakować, każdy nośnik musi mieć naklejoną etykietę.">
	{#if gateFor}
		<ul class="flex flex-col gap-2">
			{#each gateFor.carriers.filter((c) => !c.hasLabel) as c}
				<li class="rounded-xl border border-line p-3">
					<CarrierCode code={c.code} class="text-lg" />
					<p class="text-sm text-muted">{c.name} · {c.dimensions}</p>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet footer()}
		<Button variant="primary" size="lg" loading={busyId === gateFor?.id} onclick={printAndOpen}><Printer class="size-5" />Drukuj etykiety i przejdź</Button>
		<Button variant="ghost" onclick={() => (gateOpen = false)}>Anuluj</Button>
	{/snippet}
</Sheet>

<!-- Blokady wydania -->
<Sheet bind:open={blockedOpen} title="Nie można jeszcze wydać" description={blocked ? `${blocked.po.number} · ${blocked.po.customer.name}` : ''}>
	{#if blocked}
		<ul class="flex flex-col gap-2">
			{#each blocked.blockers as b}
				<li class="flex gap-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />{b}</li>
			{/each}
		</ul>
	{/if}
	{#snippet footer()}
		{#if blockedOnlyByLabels}
			<Button variant="primary" size="lg" onclick={printMissingAndRelease}><Printer class="size-5" />Drukuj etykiety i wydaj</Button>
		{/if}
		<Button
			variant={blockedOnlyByLabels ? 'secondary' : 'primary'}
			size="lg"
			onclick={() => {
				blockedOpen = false;
				if (blocked) open(blocked.po);
			}}>Otwórz kompletację</Button
		>
	{/snippet}
</Sheet>

<LabelsSheet bind:open={labelsOpen} {labels} {printer} />
