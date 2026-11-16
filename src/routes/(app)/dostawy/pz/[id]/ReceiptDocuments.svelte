<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { addReceiptDocuments, removeReceiptDocument } from '$lib/api';
	import type { ReceiptDocument, ReceiptDocumentKind } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtTime } from '$lib/format';
	import Button from '$lib/components/Button.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	/** Dokumenty dostawy (WZ, CMR, faktura…) – zdjęcia na poziomie całej PZ, nie pozycji */
	let { receiptId, number, documents }: { receiptId: string; number: string; documents: ReceiptDocument[] } = $props();

	const KINDS: { value: ReceiptDocumentKind; label: string; short: string }[] = [
		{ value: 'WZ', label: 'WZ dostawcy', short: 'WZ' },
		{ value: 'CMR', label: 'CMR / list przewozowy', short: 'CMR' },
		{ value: 'FAKTURA', label: 'Faktura', short: 'Faktura' },
		{ value: 'INNY', label: 'Inny', short: 'Inny' }
	];
	const kindLabel = (k: ReceiptDocumentKind) => KINDS.find((x) => x.value === k)?.label ?? k;
	const kindShort = (k: ReceiptDocumentKind) => KINDS.find((x) => x.value === k)?.short ?? k;

	let addOpen = $state(false);
	let kind = $state<ReceiptDocumentKind>('WZ');
	let photos = $state<string[]>([]);
	let busy = $state(false);
	let preview = $state<ReceiptDocument | null>(null);

	function openAdd() {
		kind = 'WZ';
		photos = [];
		addOpen = true;
	}

	async function save() {
		busy = true;
		try {
			await addReceiptDocuments(receiptId, kind, [...photos]);
			toast.ok(`Dodano: ${kindLabel(kind)}`, `${photos.length} zdj. · ${number}`);
			addOpen = false;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function remove(d: ReceiptDocument) {
		if (!confirm(`Usunąć zdjęcie (${kindLabel(d.kind)})?`)) return;
		try {
			await removeReceiptDocument(receiptId, d.id);
			preview = null;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
	<div class="flex items-center justify-between gap-2">
		<p class="flex items-center gap-2 text-sm font-bold"><FileText class="size-4 text-muted" />Dokumenty ({documents.length})</p>
		<Button size="sm" onclick={openAdd}><Plus class="size-4" />Dodaj zdjęcie</Button>
	</div>
	{#if documents.length}
		<ul class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
			{#each documents as d (d.id)}
				<li class="w-20 shrink-0">
					<button type="button" class="block aspect-[3/4] w-full overflow-hidden rounded-lg bg-bg ring-1 ring-line" onclick={() => (preview = d)}>
						<img src={d.src} alt={kindLabel(d.kind)} class="size-full object-cover" />
					</button>
					<p class="mt-1 truncate text-[11px] font-bold">{kindShort(d.kind)}</p>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-xs text-muted">WZ, CMR, faktura – zdjęcie całego dokumentu dostawy.</p>
	{/if}
</section>

<Sheet bind:open={addOpen} title="Dodaj dokument" description={number}>
	<p class="mb-1.5 text-sm font-bold">Rodzaj dokumentu</p>
	<div class="mb-4 grid grid-cols-2 gap-1.5">
		{#each KINDS as k (k.value)}
			<button type="button" class="h-11 rounded-xl border-2 px-2 text-sm font-bold {kind === k.value ? 'border-ink bg-ink text-white' : 'border-line bg-surface'}" onclick={() => (kind = k.value)}>{k.label}</button>
		{/each}
	</div>
	<PhotoCapture bind:photos />
	{#snippet footer()}
		<Button variant="primary" size="lg" disabled={!photos.length} loading={busy} onclick={save}>Zapisz ({photos.length} zdj.)</Button>
	{/snippet}
</Sheet>

{#if preview}
	<div class="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-ink text-white">
		<div class="flex items-center gap-2 p-3">
			<div class="min-w-0 flex-1">
				<p class="font-bold">{kindLabel(preview.kind)}</p>
				<p class="text-xs text-white/60">{preview.by}, {fmtTime(preview.takenAt)}</p>
			</div>
			<button type="button" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Usuń" onclick={() => remove(preview!)}><Trash2 class="size-5" /></button>
			<button type="button" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Zamknij" onclick={() => (preview = null)}><X class="size-6" /></button>
		</div>
		<img src={preview.src} alt={kindLabel(preview.kind)} class="min-h-0 flex-1 object-contain" />
	</div>
{/if}
