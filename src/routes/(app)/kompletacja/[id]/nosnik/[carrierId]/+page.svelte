<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { deleteCarrier, printLabels, updateCarrier } from '$lib/api';
	import type { CarrierDTO, CarrierKind, CustomDimensions, LabelDTO } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { fmtKg } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import LabelStateBadge from '$lib/components/LabelStateBadge.svelte';
	import LabelsSheet from '$lib/components/LabelsSheet.svelte';
	import Printer from '@lucide/svelte/icons/printer';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Ruler from '@lucide/svelte/icons/ruler';
	import Pencil from '@lucide/svelte/icons/pencil';

	let { data } = $props();
	let po = $derived(data.po);
	let carrier = $derived(data.carrier);
	let readonly = $derived(po.released);
	let back = $derived(`/kompletacja/${po.id}?tab=nosniki`);

	// nie można mieszać palet z paczkami – jeśli są inne nośniki, typ musi być tego samego rodzaju
	let lockedKind: CarrierKind | null = $derived(po.carriers.length > 1 ? carrier.kind : null);

	// --- formularz: typ nośnika + waga (zawartość jest tylko do odczytu) ---
	type Form = { typeId: string; custom: CustomDimensions; editWeight: boolean; weight: number };
	function initForm(c: CarrierDTO): Form {
		return {
			typeId: c.typeId ?? 'custom',
			custom: { ...(c.custom ?? { name: '', kind: c.kind, lengthCm: 0, widthCm: 0, heightCm: 0, tareKg: 0 }) },
			editWeight: c.weightOverrideKg !== null,
			weight: c.weightOverrideKg ?? c.computedWeightKg
		};
	}
	let form: Form = $state(initForm(untrack(() => data.carrier)));
	$effect.pre(() => {
		form = initForm(carrier);
	});

	let dirty = $derived(
		JSON.stringify({ t: form.typeId, c: form.typeId === 'custom' ? form.custom : null, w: form.editWeight ? Number(form.weight) : null }) !==
			JSON.stringify({ t: carrier.typeId ?? 'custom', c: carrier.custom, w: carrier.weightOverrideKg })
	);

	let busy = $state(false);
	let deleteOpen = $state(false);
	let labels: LabelDTO[] = $state([]);
	let labelsOpen = $state(false);

	async function save() {
		busy = true;
		try {
			let isCustom = form.typeId === 'custom';
			let c = form.custom;
			await updateCarrier(carrier.id, {
				typeId: isCustom ? null : form.typeId,
				custom: isCustom ? { ...c, lengthCm: Number(c.lengthCm), widthCm: Number(c.widthCm), heightCm: Number(c.heightCm), tareKg: Number(c.tareKg) } : null,
				weightOverrideKg: form.editWeight ? Number(form.weight) : null
			});
			toast.ok(`Zapisano nośnik ${carrier.code}`);
			await goto(back);
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		busy = true;
		try {
			await deleteCarrier(carrier.id);
			toast.info(`Usunięto nośnik ${carrier.code}`, carrier.items.length ? 'Produkty wróciły do spakowania.' : undefined);
			await goto(back);
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function print(withContent: boolean) {
		busy = true;
		try {
			labels = await printLabels([carrier.id], { withContent });
			labelsOpen = true;
			await invalidateAll();
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	const dimFields = [
		{ key: 'lengthCm', label: 'Dł. cm' },
		{ key: 'widthCm', label: 'Szer. cm' },
		{ key: 'heightCm', label: 'Wys. cm' }
	] as const;
</script>

<PageHeader title="Nośnik" subtitle="{po.customer.name} · {po.salesOrder.number}" {back} />

<main class="flex flex-col gap-5 px-3 pt-3 {readonly ? 'pb-8' : 'pb-28'}">
	<!-- identyfikacja – to, co magazynier widzi na naklejonej etykiecie -->
	<section class="rounded-3xl border border-line bg-surface p-4">
		<p class="text-xs font-bold tracking-wide text-muted uppercase">Kod nośnika</p>
		<CarrierCode code={carrier.code} class="block text-2xl" />
		<p class="mt-1 text-sm text-muted">{po.customer.name}{po.forwarder ? ` · ${po.forwarder.name}` : ''}</p>
		{#if !carrier.hasLabel || carrier.contentLabelOutdated}<div class="mt-2"><LabelStateBadge {carrier} /></div>{/if}
		<div class="mt-3 grid grid-cols-2 gap-2">
			<Button disabled={busy || dirty} onclick={() => print(false)}><Printer class="size-4" />Etykieta</Button>
			<Button variant={carrier.contentLabelOutdated ? 'task' : 'secondary'} disabled={busy || carrier.totalQty === 0 || dirty} onclick={() => print(true)}>
				<Printer class="size-4" />Z zawartością
			</Button>
		</div>
		{#if dirty}<p class="mt-2 text-xs text-muted">Zapisz zmiany, aby wydrukować etykiety.</p>{/if}
	</section>

	<!-- typ nośnika -->
	<section>
		<h2 class="mb-2 px-1 text-sm font-extrabold tracking-wide text-muted uppercase">Typ nośnika</h2>
		<div class="grid grid-cols-2 gap-2">
			{#each po.carrierTypes as t}
				<button
					type="button"
					disabled={readonly || (lockedKind !== null && t.kind !== lockedKind)}
					class="flex items-center gap-2 rounded-2xl border-2 p-3 text-left disabled:opacity-35 {form.typeId === t.id ? 'border-ink bg-task-soft' : 'border-line bg-surface'}"
					onclick={() => (form.typeId = t.id)}
				>
					<CarrierIcon kind={t.kind} class="size-5 shrink-0" />
					<span class="min-w-0">
						<span class="block truncate text-sm font-bold">{t.name}</span>
						<span class="block text-xs text-muted">{t.lengthCm}×{t.widthCm}×{t.heightCm}</span>
					</span>
				</button>
			{/each}
			<button
				type="button"
				disabled={readonly}
				class="flex items-center gap-2 rounded-2xl border-2 p-3 text-left {form.typeId === 'custom' ? 'border-ink bg-task-soft' : 'border-dashed border-line-strong bg-surface'}"
				onclick={() => {
					form.typeId = 'custom';
					if (lockedKind) form.custom.kind = lockedKind;
				}}
			>
				<Ruler class="size-5 shrink-0" />
				<span class="text-sm font-bold">Własny</span>
			</button>
		</div>
		{#if form.typeId === 'custom'}
			<div class="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3">
				<label class="col-span-3 text-sm font-semibold">
					Nazwa
					<input bind:value={form.custom.name} disabled={readonly} class="mt-1 h-11 w-full rounded-xl border border-line-strong px-3 font-normal outline-none focus:border-ink" />
				</label>
				{#each dimFields as f}
					<label class="text-sm font-semibold">
						{f.label}
						<input type="number" inputmode="numeric" disabled={readonly} bind:value={form.custom[f.key]} class="mt-1 h-11 w-full rounded-xl border border-line-strong px-3 font-mono font-normal outline-none focus:border-ink" />
					</label>
				{/each}
			</div>
		{/if}
	</section>

	<!-- zawartość – tylko do odczytu, powstaje wyłącznie przez skanowanie przy pakowaniu -->
	<section>
		<h2 class="mb-2 px-1 text-sm font-extrabold tracking-wide text-muted uppercase">Zawartość ({carrier.items.length})</h2>
		<ul class="overflow-hidden rounded-2xl border border-line bg-surface">
			{#each carrier.items as item (item.lineId)}
				<li class="flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-0">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold">{item.product.name}</p>
						<p class="font-mono text-xs text-muted">{item.product.sku} · {item.location}</p>
					</div>
					<p class="font-mono font-bold whitespace-nowrap">{item.qty} <span class="text-xs font-normal text-muted">{item.product.unit}</span></p>
				</li>
			{:else}
				<li class="p-5 text-center text-sm text-muted">Nośnik jest pusty</li>
			{/each}
		</ul>
	</section>

	<!-- waga -->
	<section class="rounded-2xl border border-line bg-surface p-3">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-xs font-bold tracking-wide text-muted uppercase">Waga</p>
				<p class="text-2xl font-extrabold tabular-nums">{fmtKg(form.editWeight ? Number(form.weight) || 0 : carrier.computedWeightKg)}</p>
				{#if form.editWeight}<p class="text-xs text-muted">wyliczona: {fmtKg(carrier.computedWeightKg)}</p>{/if}
			</div>
			{#if !readonly && !form.editWeight}
				<Button
					size="sm"
					onclick={() => {
						form.editWeight = true;
						form.weight = carrier.computedWeightKg;
					}}><Pencil class="size-4" />Edytuj wagę</Button
				>
			{:else if !readonly}
				<Button size="sm" variant="ghost" onclick={() => (form.editWeight = false)}>Przywróć wyliczoną</Button>
			{/if}
		</div>
		{#if form.editWeight && !readonly}
			<input type="number" inputmode="decimal" bind:value={form.weight} class="mt-2 h-12 w-full rounded-xl border border-line-strong px-3 font-mono text-lg font-bold outline-none focus:border-ink" />
		{/if}
	</section>

	{#if !readonly}
		<Button variant="danger" size="lg" onclick={() => (deleteOpen = true)}><Trash2 class="size-5" />Usuń nośnik</Button>
	{/if}
</main>

{#if !readonly}
	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="grid grid-cols-[1fr_2fr] gap-2 pb-3">
			<Button size="lg" href={back}>Anuluj</Button>
			<Button variant="primary" size="lg" loading={busy} disabled={!dirty} onclick={save}>Zapisz</Button>
		</div>
	</div>
{/if}

<Sheet bind:open={deleteOpen} title="Usunąć nośnik?" description={carrier.items.length ? `Spakowane produkty (${carrier.items.length} poz.) wrócą do spakowania.` : 'Nośnik jest pusty.'}>
	<div class="rounded-xl border border-line p-3"><CarrierCode code={carrier.code} class="text-lg" /></div>
	{#if carrier.hasLabel}
		<p class="mt-2 rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">Zdejmij i zniszcz naklejoną etykietę.</p>
	{/if}
	{#snippet footer()}
		<Button variant="danger" size="lg" loading={busy} onclick={remove}><Trash2 class="size-5" />Usuń nośnik</Button>
		<Button variant="ghost" onclick={() => (deleteOpen = false)}>Anuluj</Button>
	{/snippet}
</Sheet>

<LabelsSheet bind:open={labelsOpen} {labels} printer={data.context.operator.printer} />
