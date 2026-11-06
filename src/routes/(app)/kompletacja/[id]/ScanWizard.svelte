<script lang="ts">
	import { tick } from 'svelte';
	import type { CarrierDTO, PickLineDTO } from '$lib/types';
	import Button from '$lib/components/Button.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import Check from '@lucide/svelte/icons/check';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Plus from '@lucide/svelte/icons/plus';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Sheet from '$lib/components/Sheet.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import { fmtKg } from '$lib/format';

	/**
	 * Pakowanie pozycji przez skanowanie: półka -> towar -> ilość -> nośnik.
	 * Skaner działa jak klawiatura (wpisuje kod + Enter), więc każdy krok to pole tekstowe.
	 * Przyciski "Symuluj skan" istnieją tylko na potrzeby makiety.
	 */
	interface Props {
		line: PickLineDTO;
		carriers: CarrierDTO[];
		busy: boolean;
		onPack: (carrierCode: string, qty: number) => Promise<string | null>;
		onAddCarrier: () => void;
	}
	let { line, carriers, busy, onPack, onAddCarrier }: Props = $props();

	type StepId = 'shelf' | 'product' | 'qty' | 'carrier';
	const steps: { id: StepId; title: string }[] = [
		{ id: 'shelf', title: 'Zeskanuj kod półki' },
		{ id: 'product', title: 'Zeskanuj kod towaru' },
		{ id: 'qty', title: 'Podaj ilość' },
		{ id: 'carrier', title: 'Zeskanuj kod nośnika' }
	];

	let active = $state(0);
	let input = $state('');
	let error = $state<string | null>(null);
	let scanned = $state<Record<StepId, string>>({ shelf: '', product: '', qty: '', carrier: '' });
	let qty = $state(0);

	// nowa pozycja -> zaczynamy od początku
	$effect.pre(() => {
		line.id;
		line.remainingQty;
		active = 0;
		input = '';
		error = null;
		scanned = { shelf: '', product: '', qty: '', carrier: '' };
		qty = line.remainingQty;
	});

	const norm = (v: string) => v.trim().toUpperCase();

	function next(value: string) {
		scanned[steps[active].id] = value;
		active++;
		input = '';
		error = null;
	}

	async function submit(value = input) {
		let step = steps[active].id;
		error = null;
		if (step === 'shelf') {
			if (norm(value) !== norm(line.location)) return (error = `To nie ta półka – idź do ${line.location}`);
			next(norm(value));
		} else if (step === 'product') {
			if (![line.product.ean, line.product.sku].map(norm).includes(norm(value))) return (error = `To nie jest ${line.product.name}`);
			next(norm(value));
		} else if (step === 'qty') {
			next(`${qty} ${line.product.unit}`);
		} else {
			if (!norm(value)) return;
			let err = await onPack(norm(value), qty);
			if (err) error = err;
		}
	}

	function goTo(i: number) {
		if (i >= active) return;
		active = i;
		input = '';
		error = null;
	}

	function autofocus(node: HTMLInputElement) {
		tick().then(() => node.focus());
	}

	// wybór nośnika z listy – alternatywa dla skanu, gdy kodu nie da się zeskanować
	let pickerOpen = $state(false);
	function pickCarrier(code: string) {
		pickerOpen = false;
		submit(code);
	}
</script>

<ol class="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
	{#each steps as step, i (step.id)}
		{@const isDone = i < active}
		{@const isActive = i === active}
		<li class="border-t border-line first:border-0 {isActive ? 'bg-task-soft' : ''}">
			<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" disabled={!isDone} onclick={() => goTo(i)}>
				<span class="grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold {isDone ? 'bg-ok text-white' : isActive ? 'bg-ink text-white' : 'bg-bg text-muted'}">
					{#if isDone}<Check class="size-4" strokeWidth={3} />{:else}{i + 1}{/if}
				</span>
				<span class="flex-1 font-bold {isDone || isActive ? 'text-ink' : 'text-muted'}">{step.title}</span>
				{#if isDone}<span class="font-mono text-sm font-bold text-ok">{scanned[step.id]}</span>{/if}
			</button>

			{#if isActive}
				<div class="px-4 pb-4">
					{#if step.id === 'qty'}
						<div class="flex gap-2">
							<QtyStepper bind:value={qty} min={1} max={line.remainingQty} unit={line.product.unit} size="lg" class="flex-1" />
							<Button variant="primary" size="lg" class="h-14" onclick={() => submit()}>Dalej</Button>
						</div>
						{#if qty < line.remainingQty}
							<p class="mt-2 text-xs text-muted">Częściowo – {line.remainingQty - qty} {line.product.unit} zostanie do spakowania</p>
						{/if}
					{:else}
						<form
							class="flex gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								submit();
							}}
						>
							<label class="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 bg-surface px-3 {error ? 'border-bad' : 'border-ink'}">
								<ScanLine class="size-5 shrink-0 text-muted" />
								<input
									use:autofocus
									bind:value={input}
									class="h-full min-w-0 flex-1 bg-transparent font-mono text-lg font-bold uppercase outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:normal-case"
									placeholder={step.id === 'shelf' ? 'Kod półki' : step.id === 'product' ? 'EAN / indeks' : 'Kod nośnika'}
									autocomplete="off"
									autocapitalize="characters"
									spellcheck="false"
								/>
							</label>
							<Button type="submit" variant="primary" size="lg" class="h-14" loading={busy && step.id === 'carrier'}>OK</Button>
						</form>
					{/if}

					{#if error}<p class="mt-2 text-sm font-bold text-bad">{error}</p>{/if}

					{#if step.id === 'carrier'}
						{#if carriers.length}
							<Button size="md" class="mt-2 w-full" disabled={busy} onclick={() => (pickerOpen = true)}><ListChecks class="size-4" />Wybierz nośnik z listy</Button>
						{:else}
							<p class="mt-2 text-sm text-muted">Zamówienie nie ma jeszcze nośników.</p>
							<Button size="md" class="mt-2 w-full" onclick={onAddCarrier}><Plus class="size-4" />Dodaj nośnik</Button>
						{/if}
					{/if}

					<!-- tylko makieta: symulacja skanera -->
					{#if step.id === 'shelf' || step.id === 'product'}
					<div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-line-strong pt-2 text-xs text-muted">
						<span>Makieta – symuluj skan:</span>
						{#if step.id === 'shelf'}
							<button type="button" class="rounded-md bg-ink/6 px-2 py-1 font-mono" onclick={() => submit(line.location)}>{line.location}</button>
						{:else if step.id === 'product'}
							<button type="button" class="rounded-md bg-ink/6 px-2 py-1 font-mono" onclick={() => submit(line.product.ean)}>{line.product.ean}</button>
						{/if}
					</div>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ol>

<Sheet bind:open={pickerOpen} title="Wybierz nośnik" description="Na który nośnik pakujesz {qty} {line.product.unit} – {line.product.name}?">
	<ul class="flex flex-col gap-2">
		{#each carriers as c (c.id)}
			<li>
				<button type="button" class="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3 text-left active:border-ink active:bg-task-soft" onclick={() => pickCarrier(c.code)}>
					<span class="grid size-11 shrink-0 place-items-center rounded-xl bg-bg"><CarrierIcon kind={c.kind} /></span>
					<span class="min-w-0 flex-1">
						<CarrierCode code={c.code} class="block text-[17px]" />
						<span class="block text-xs text-muted">{c.name} · {c.items.length} poz. · {fmtKg(c.weightKg)}{c.hasLabel ? '' : ' · bez etykiety'}</span>
					</span>
					<ChevronRight class="size-5 shrink-0 text-muted" />
				</button>
			</li>
		{/each}
	</ul>
</Sheet>
