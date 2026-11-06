<script lang="ts">
	import { untrack } from 'svelte';
	import { mockScanner, type ReceiptLineInput } from '$lib/api';
	import type { BatchEntry, ReceiptLineDTO } from '$lib/types';
	import { fmtDiff } from '$lib/format';
	import Sheet from '$lib/components/Sheet.svelte';
	import Button from '$lib/components/Button.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import ScanInput from '$lib/components/ScanInput.svelte';
	import ProductFlags from '$lib/components/ProductFlags.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';

	/**
	 * Przyjęcie jednej pozycji PZ: ilość + (zależnie od produktu) serie/partie albo numery seryjne.
	 * Komponent jest montowany na nowo dla każdej pozycji ({#key}), więc stan startowy bierze z `line`.
	 */
	interface Props {
		open: boolean;
		line: ReceiptLineDTO;
		busy: boolean;
		onSave: (input: ReceiptLineInput) => Promise<string | null>;
	}
	let { open = $bindable(), line, busy, onSave }: Props = $props();

	let p = $derived(line.product);
	let start = untrack(() => line);
	let qty = $state(start.checked ? start.receivedQty : start.product.tracking === 'SERIAL' ? 0 : start.expectedQty);
	let batches = $state<BatchEntry[]>(start.batches.length ? structuredClone(start.batches) : [{ batch: '', expiry: null, qty: start.checked ? start.receivedQty : start.expectedQty }]);
	let serials = $state<string[]>([...start.serials]);
	let note = $state(start.note ?? '');
	let error = $state<string | null>(null);
	let serialHint = $state(mockScanner.serial(start.product.sku));

	let received = $derived(p.tracking === 'SERIAL' ? serials.length : qty);
	let diff = $derived(received - line.expectedQty);
	let covered = $derived(batches.reduce((n, b) => n + (b.qty || 0), 0));

	// jedna partia = cała ilość (najczęstszy przypadek), przy kilku magazynier rozdziela sam
	function setQty(v: number) {
		qty = v;
		if (batches.length === 1) batches[0].qty = v;
	}

	function addSerial(code: string): string | null {
		if (serials.includes(code)) return `Numer ${code} jest już zeskanowany`;
		serials = [...serials, code];
		serialHint = mockScanner.serial(p.sku);
		return null;
	}

	async function save() {
		error = await onSave({ receivedQty: received, batches: p.tracking === 'BATCH' ? batches : [], serials: p.tracking === 'SERIAL' ? serials : [], note: note || null });
	}
</script>

<Sheet bind:open title={p.name} description="{p.sku} · EAN {p.ean} · {line.purchaseOrderNumber}" tall>
	<div class="flex flex-wrap items-center gap-1.5">
		<ProductFlags product={p} />
		{#if p.tracking === 'NONE' && !p.requiresQc}<span class="text-xs text-muted">Bez serii i numerów seryjnych</span>{/if}
	</div>
	{#if p.requiresQc}
		<p class="mt-3 flex gap-2 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><ShieldAlert class="size-5 shrink-0" />Produkt wymaga kontroli jakości – sprawdź stan towaru i opakowań przed przyjęciem.</p>
	{/if}

	<div class="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-bg p-3">
		<div>
			<p class="text-xs font-bold text-muted uppercase">Oczekiwane</p>
			<p class="font-mono text-2xl font-extrabold">{line.expectedQty} <span class="text-sm font-normal">{p.unit}</span></p>
		</div>
		<div class="text-right">
			<p class="text-xs font-bold text-muted uppercase">Przyjmowane</p>
			<p class="font-mono text-2xl font-extrabold {diff === 0 ? 'text-ok' : 'text-warn'}">{received} <span class="text-sm font-normal">{p.unit}</span></p>
		</div>
	</div>

	{#if p.tracking === 'SERIAL'}
		<p class="mt-4 mb-1.5 text-sm font-bold">Zeskanuj numer seryjny każdej sztuki</p>
		<ScanInput placeholder="Numer seryjny (SN)" onScan={addSerial} hints={[{ code: serialHint, label: 'SN z naklejki' }]} />
		<ul class="mt-3 flex flex-col gap-1.5">
			{#each serials as s, i (s)}
				<li class="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
					<span class="w-6 text-xs text-muted">{i + 1}.</span>
					<span class="flex-1 font-mono text-sm font-bold">{s}</span>
					<button type="button" class="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Usuń" onclick={() => (serials = serials.filter((x) => x !== s))}><X class="size-4" /></button>
				</li>
			{/each}
		</ul>
		{#if serials.length}
			<Button variant="ghost" size="sm" class="mt-1" onclick={() => (serials = [])}>Wyczyść wszystkie</Button>
		{:else}
			<Button size="sm" class="mt-2" onclick={() => (serials = [])}>Brak w dostawie (0)</Button>
		{/if}
	{:else}
		<p class="mt-4 mb-1.5 text-sm font-bold">Ilość przyjęta</p>
		<QtyStepper bind:value={() => qty, setQty} min={0} max={Math.max(999, line.expectedQty * 3)} unit={p.unit} size="lg" />
		<div class="mt-2 grid grid-cols-2 gap-2">
			<Button size="sm" onclick={() => setQty(line.expectedQty)}><Check class="size-4" />Zgodne ({line.expectedQty})</Button>
			<Button size="sm" onclick={() => setQty(0)}>Brak w dostawie (0)</Button>
		</div>
	{/if}

	{#if p.tracking === 'BATCH' && received > 0}
		<div class="mt-5 flex items-center justify-between">
			<p class="text-sm font-bold">Seria / partia</p>
			<span class="text-xs font-bold {covered === received ? 'text-ok' : 'text-bad'}">przypisano {covered} z {received}</span>
		</div>
		<ul class="mt-2 flex flex-col gap-2">
			{#each batches as b, i (i)}
				<li class="rounded-xl border border-line p-3">
					<div class="flex gap-2">
						<input bind:value={b.batch} class="h-11 min-w-0 flex-1 rounded-xl border-2 border-line-strong px-3 font-mono font-bold uppercase outline-none focus:border-ink" placeholder="Nr serii" autocapitalize="characters" />
						<button type="button" class="h-11 shrink-0 rounded-xl bg-ink/6 px-2 text-xs text-muted" onclick={() => ((b.batch = mockScanner.batch(p.sku)), (b.expiry ??= mockScanner.expiry()))}>symuluj</button>
						{#if batches.length > 1}
							<button type="button" class="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/5" aria-label="Usuń partię" onclick={() => batches.splice(i, 1)}><Trash2 class="size-4" /></button>
						{/if}
					</div>
					<div class="mt-2 flex items-center gap-2">
						<label class="flex-1 text-xs text-muted">
							Ważne do
							<input type="date" bind:value={b.expiry} class="mt-0.5 h-11 w-full rounded-xl border-2 border-line-strong px-2 text-sm text-ink outline-none focus:border-ink" />
						</label>
						{#if batches.length > 1}
							<label class="w-36 text-xs text-muted">Ilość<QtyStepper bind:value={b.qty} min={0} max={received} class="mt-0.5" /></label>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		<Button size="sm" class="mt-2 w-full" onclick={() => batches.push({ batch: '', expiry: null, qty: Math.max(0, received - covered) })}><Plus class="size-4" />Kolejna partia (podział ilości)</Button>
	{/if}

	<label class="mt-5 block text-sm font-bold">
		Uwagi {diff !== 0 ? '(powód rozbieżności)' : ''}
		<textarea bind:value={note} rows="2" class="mt-1 w-full rounded-xl border-2 border-line-strong p-3 text-base font-normal outline-none focus:border-ink" placeholder="np. uszkodzone opakowanie"></textarea>
	</label>

	{#snippet footer()}
		{#if diff !== 0}
			<p class="flex gap-2 rounded-xl bg-warn-soft p-2.5 text-sm font-semibold text-warn"><TriangleAlert class="size-5 shrink-0" />Rozbieżność {fmtDiff(diff)} {p.unit} – zamknięcie PZ będzie wymagało przełożonego.</p>
		{/if}
		{#if error}<p class="text-sm font-bold text-bad">{error}</p>{/if}
		<Button variant="task" size="lg" loading={busy} onclick={save}><Check class="size-5" />Zapisz pozycję</Button>
	{/snippet}
</Sheet>
