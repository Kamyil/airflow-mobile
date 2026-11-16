<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { ApiError, correctReceiptBatch } from '$lib/api';
	import type { ReceiptLineDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtDate, fmtDateTime } from '$lib/format';
	import Sheet from '$lib/components/Sheet.svelte';
	import Button from '$lib/components/Button.svelte';
	import History from '@lucide/svelte/icons/history';

	/**
	 * Korekta serii / daty ważności na zrealizowanej PZ. Ilości bez zmian –
	 * poprawka trafia też na stany i do zlecenia MWS. Montowany na nowo dla każdej pozycji ({#key}).
	 */
	let { open = $bindable(), receiptId, line }: { open: boolean; receiptId: string; line: ReceiptLineDTO } = $props();

	let rows = $state(untrack(() => line.batches.map((b) => ({ batch: b.batch, expiry: b.expiry }))));
	let errors = $state<Record<number, string>>({});
	let busy = $state<number | null>(null);

	const changed = (i: number) => rows[i].batch.trim().toUpperCase() !== line.batches[i].batch || rows[i].expiry !== line.batches[i].expiry;

	async function save(i: number) {
		busy = i;
		errors = { ...errors, [i]: '' };
		try {
			let from = line.batches[i].batch;
			await correctReceiptBatch(receiptId, line.id, i, { batch: rows[i].batch, expiry: rows[i].expiry || null });
			toast.ok('Seria poprawiona', `${from} → ${rows[i].batch.trim().toUpperCase()}`);
			await invalidateAll();
		} catch (e) {
			if (e instanceof ApiError) errors = { ...errors, [i]: e.message };
			else toast.error(e);
		} finally {
			busy = null;
		}
	}
</script>

<Sheet bind:open title="Korekta serii" description="{line.product.name} · {line.product.sku}">
	<p class="mb-3 text-sm text-muted">Poprawka numeru serii lub daty ważności. Ilości się nie zmieniają – zmiana trafi też na stany magazynowe i do zlecenia MWS.</p>
	<ul class="flex flex-col gap-3">
		{#each line.batches as b, i (i)}
			<li class="rounded-2xl border border-line p-3">
				<p class="mb-2 flex justify-between text-xs font-bold text-muted uppercase"><span>Seria {i + 1}</span><span class="font-mono normal-case">{b.qty} {line.product.unit}</span></p>
				<input bind:value={rows[i].batch} aria-label="Numer serii" class="h-12 w-full rounded-xl border-2 border-line-strong px-3 font-mono text-lg font-bold uppercase outline-none focus:border-ink" />
				<label class="mt-2 block text-xs text-muted">
					Ważne do
					<input type="date" bind:value={rows[i].expiry} class="mt-1 h-12 w-full rounded-xl border-2 border-line-strong px-3 text-base text-ink outline-none focus:border-ink" />
				</label>
				{#if errors[i]}<p class="mt-2 text-sm font-bold text-bad">{errors[i]}</p>{/if}
				<Button variant="primary" class="mt-2 w-full" disabled={!changed(i) || busy !== null} loading={busy === i} onclick={() => save(i)}>Zapisz korektę</Button>
			</li>
		{/each}
	</ul>
	{#if line.batchCorrections?.length}
		<p class="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase"><History class="size-3.5" />Historia korekt</p>
		<ul class="divide-y divide-line rounded-xl border border-line text-sm">
			{#each line.batchCorrections as c, i (i)}
				<li class="px-3 py-2">
					<p class="font-mono font-bold">{c.from} → {c.to}</p>
					{#if c.expiryFrom !== c.expiryTo}<p class="text-xs text-muted">ważność {c.expiryFrom ? fmtDate(c.expiryFrom) : '—'} → {c.expiryTo ? fmtDate(c.expiryTo) : '—'}</p>{/if}
					<p class="text-xs text-muted">{c.by}, {fmtDateTime(c.at)}</p>
				</li>
			{/each}
		</ul>
	{/if}
</Sheet>
