<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, deleteTransferDraft, executeTransferMove, submitTransfer } from '$lib/api';
	import type { TransferLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDateTime, fmtTime } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import Send from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();
	let t = $derived(data.transfer);
	let busy = $state(false);
	let selectedId = $state<string | null>(null);
	let line = $derived(t.lines.find((l) => l.id === selectedId && l.remainingQty > 0) ?? t.current);
	let canExecute = $derived(t.status !== 'DONE');

	type StepId = 'from' | 'product' | 'qty' | 'to';
	const STEPS: { id: StepId; title: string }[] = [
		{ id: 'from', title: 'Zeskanuj lokalizację źródłową' },
		{ id: 'product', title: 'Zeskanuj produkt' },
		{ id: 'qty', title: 'Podaj ilość' },
		{ id: 'to', title: 'Zeskanuj lokalizację docelową' }
	];
	let active = $state(0);
	let scanned = $state<Record<StepId, string>>({ from: '', product: '', qty: '', to: '' });
	let qty = $state(0);

	$effect.pre(() => {
		line?.id;
		line?.remainingQty;
		active = 0;
		scanned = { from: '', product: '', qty: '', to: '' };
		qty = Math.min(line?.remainingQty ?? 0, line?.availableQty ?? 0) || (line?.remainingQty ?? 0);
	});

	function next(v: string) {
		scanned[STEPS[active].id] = v;
		active++;
	}

	async function onScan(code: string): Promise<string | null> {
		if (!line) return null;
		let step = STEPS[active].id;
		if (step === 'from') {
			if (code !== line.fromLocation) return `To nie ta lokalizacja – idź do ${line.fromLocation}`;
			next(code);
		} else if (step === 'product') {
			if (![line.product.ean, line.product.sku.toUpperCase()].includes(code)) return `To nie jest ${line.product.name}`;
			next(code);
		} else if (step === 'to') {
			let current = line;
			busy = true;
			try {
				let { done } = await executeTransferMove({ transferId: t.id, lineId: current.id, qty, to: code });
				toast.ok(`Przesunięto ${qty} ${current.product.unit}`, `${current.fromLocation} → ${code}`);
				if (current.toLocation && code !== current.toLocation) toast.info('Inna lokalizacja docelowa niż na dokumencie');
				if (done) toast.ok(`${t.number} zrealizowane`);
				selectedId = null;
				await invalidateAll();
				return null;
			} catch (e) {
				if (e instanceof ApiError) return [e.message, ...e.details].join(' · ');
				throw e;
			} finally {
				busy = false;
			}
		}
		return null;
	}

	async function act(fn: () => Promise<void>, msg: string, then?: string) {
		busy = true;
		try {
			await fn();
			toast.ok(msg);
			if (then) await goto(then);
			else await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	let hintFor = $derived.by(() => {
		if (!line) return [];
		let s = STEPS[active]?.id;
		if (s === 'from') return [{ code: line.fromLocation }];
		if (s === 'product') return [{ code: line.product.ean, label: line.product.sku }];
		if (s === 'to') return [{ code: line.suggestedTo }];
		return [];
	});

	const isDone = (l: TransferLineDTO) => l.remainingQty === 0;
</script>

<PageHeader title={t.number} subtitle={t.reason} back="/przesuniecia" />

<div class="flex flex-col gap-3 p-3">
	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<div class="flex flex-wrap gap-1.5">
			<StatusBadge status={t.source} />
			<StatusBadge status={t.status} label={{ DRAFT: 'Szkic', TODO: 'Do realizacji', IN_PROGRESS: 'W trakcie', DONE: 'Zrealizowane' }[t.status]} />
			<Badge>{t.warehouse.code}</Badge>
		</div>
		<p class="mt-2 text-xs text-muted">Utworzył(a): {t.createdBy} · {fmtDateTime(t.createdAt)}{t.doneAt ? ` · zrealizowano ${fmtDateTime(t.doneAt)}` : ''}</p>
		{#if t.status !== 'DRAFT'}<div class="mt-3"><Progress value={t.progress.linesDone} max={t.progress.lines} label="{t.progress.linesDone}/{t.progress.lines} poz." /></div>{/if}
	</section>

	{#if t.status === 'DRAFT'}
		<section class="rounded-2xl bg-info-soft p-4 text-sm text-info">
			<p class="font-bold">Szkic MM utworzony w apce</p>
			<p class="mt-0.5">Zatwierdź, żeby trafił na listę do realizacji, albo wykonaj od razu poniżej.</p>
			<div class="mt-3 grid grid-cols-2 gap-2">
				<Button variant="primary" loading={busy} onclick={() => act(() => submitTransfer(t.id), 'MM zatwierdzone do realizacji')}><Send class="size-4" />Zatwierdź</Button>
				<Button variant="danger" disabled={busy} onclick={() => confirm('Usunąć szkic?') && act(() => deleteTransferDraft(t.id), 'Szkic usunięty', '/przesuniecia')}><Trash2 class="size-4" />Usuń szkic</Button>
			</div>
		</section>
	{/if}

	{#if canExecute && line}
		<section class="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
			<div class="p-4">
				<p class="text-lg leading-tight font-extrabold">{line.product.name}</p>
				<p class="mt-0.5 font-mono text-xs text-muted">{line.product.sku}{line.batch ? ` · seria ${line.batch}` : ''}</p>
				<div class="mt-2 flex flex-wrap gap-1.5"><ProductFlags product={line.product} /></div>
				<div class="mt-3 flex items-center gap-2 font-mono text-xl font-extrabold">
					<span class="rounded-lg bg-bg px-2 py-1">{line.fromLocation}</span><ArrowRight class="size-5 text-muted" /><span class="rounded-lg bg-task px-2 py-1 text-task-ink">{line.toLocation ?? line.suggestedTo}</span>
				</div>
				<p class="mt-2 text-sm text-muted">Do przesunięcia <b class="text-ink">{line.remainingQty} {line.product.unit}</b> · na półce <b class="text-ink">{line.availableQty}</b>{line.toLocation ? '' : ' · cel: dowolny (podpowiedź MWS)'}</p>
				{#if line.availableQty < line.remainingQty}
					<p class="mt-2 flex gap-2 rounded-xl bg-warn-soft p-2.5 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Na lokalizacji jest mniej niż na dokumencie</p>
				{/if}
			</div>
			<ol class="border-t border-line">
				{#each STEPS as s, i (s.id)}
					{@const isDoneStep = i < active}
					{@const isActive = i === active}
					<li class="border-t border-line first:border-0 {isActive ? 'bg-task-soft' : ''}">
						<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" disabled={!isDoneStep} onclick={() => (active = i)}>
							<span class="grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold {isDoneStep ? 'bg-ok text-white' : isActive ? 'bg-ink text-white' : 'bg-bg text-muted'}">{#if isDoneStep}<Check class="size-4" strokeWidth={3} />{:else}{i + 1}{/if}</span>
							<span class="flex-1 font-bold {isDoneStep || isActive ? '' : 'text-muted'}">{s.title}</span>
							{#if isDoneStep}<span class="font-mono text-sm font-bold text-ok">{scanned[s.id]}</span>{/if}
						</button>
						{#if isActive}
							<div class="px-4 pb-4">
								{#if s.id === 'qty'}
									<div class="flex gap-2">
										<QtyStepper bind:value={qty} min={1} max={Math.min(line.remainingQty, line.availableQty) || 1} unit={line.product.unit} size="lg" class="flex-1" />
										<Button variant="primary" size="lg" class="h-14" disabled={!line.availableQty} onclick={() => next(`${qty} ${line!.product.unit}`)}>Dalej</Button>
									</div>
								{:else}
									<ScanInput placeholder={s.id === 'product' ? 'EAN / indeks' : 'Kod lokalizacji'} {onScan} {busy} hints={hintFor} />
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{:else if t.status === 'DONE'}
		<section class="flex flex-col items-center gap-2 rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
			<CircleCheckBig class="size-12 text-ok" />
			<p class="text-lg font-extrabold">Przesunięcie zrealizowane</p>
		</section>
	{/if}

	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Pozycje ({t.lines.length})</h2>
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each t.lines as l (l.id)}
				<li class="border-t border-line first:border-0 {l.id === line?.id && canExecute ? 'bg-task-soft' : ''}">
					<button type="button" class="flex w-full items-start gap-3 p-3 text-left" disabled={isDone(l) || !canExecute} onclick={() => (selectedId = l.id)}>
						<span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full {isDone(l) ? 'bg-ok text-white' : 'bg-bg text-muted'}">{#if isDone(l)}<Check class="size-4" strokeWidth={3} />{:else}<ArrowRight class="size-4" />{/if}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{l.product.name}</span>
							<span class="block font-mono text-xs text-muted">{l.fromLocation} → {l.toLocation ?? 'dowolna'}{l.batch ? ` · ${l.batch}` : ''}</span>
							{#each l.moves as m, i (i)}<span class="block text-xs text-ok">✓ {m.qty} → {m.to} · {m.by}, {fmtTime(m.at)}</span>{/each}
						</span>
						<span class="font-mono font-bold whitespace-nowrap">{l.movedQty}/{l.qty}</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
</div>
