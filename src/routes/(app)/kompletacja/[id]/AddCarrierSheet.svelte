<script lang="ts">
	import { createCarrier } from '$lib/api';
	import type { CarrierKind, CarrierType, CustomDimensions, Forwarder } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Button from '$lib/components/Button.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import Ruler from '@lucide/svelte/icons/ruler';
	import Printer from '@lucide/svelte/icons/printer';

	interface Props {
		open: boolean;
		pickingOrderId: string;
		/** Rodzaj nośników już obecnych w zamówieniu – wtedy inne rodzaje są zablokowane */
		lockedKind: CarrierKind | null;
		carrierTypes: CarrierType[];
		forwarders: Forwarder[];
		onCreated: (carrierId: string, code: string) => void;
	}
	let { open = $bindable(), pickingOrderId, lockedKind, carrierTypes, forwarders, onCreated }: Props = $props();

	const emptyCustom = (): CustomDimensions => ({ name: '', kind: lockedKind ?? 'PALLET', lengthCm: 0, widthCm: 0, heightCm: 0, tareKg: 0 });

	let selected: string | 'custom' = $state('');
	let custom = $state(emptyCustom());
	let busy = $state(false);

	$effect(() => {
		if (open) {
			selected = carrierTypes.find((t) => !lockedKind || t.kind === lockedKind)?.id ?? 'custom';
			custom = emptyCustom();
		}
	});

	let selectedKind = $derived(selected === 'custom' ? custom.kind : carrierTypes.find((t) => t.id === selected)?.kind);
	let forwarder = $derived(forwarders.find((f) => f.kind === selectedKind));

	async function submit() {
		busy = true;
		try {
			let isCustom = selected === 'custom';
			let res = await createCarrier(pickingOrderId, { typeId: isCustom ? null : selected, custom: isCustom ? { ...custom } : null });
			toast.ok(`Dodano nośnik ${res.code}`, 'Etykieta wydrukowana – naklej ją na nośnik.');
			open = false;
			onCreated(res.carrierId, res.code);
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
	const kinds: { id: CarrierKind; label: string }[] = [
		{ id: 'PALLET', label: 'Paleta' },
		{ id: 'PARCEL', label: 'Paczka' }
	];
</script>

<Sheet bind:open title="Nowy nośnik" description={lockedKind ? `Zamówienie ma już ${lockedKind === 'PALLET' ? 'palety' : 'paczki'} – nie można mieszać rodzajów nośników.` : 'Rodzaj nośnika wyznaczy spedytora.'}>
	<div class="grid grid-cols-1 gap-2">
		{#each carrierTypes as t}
			{@const disabled = lockedKind !== null && t.kind !== lockedKind}
			<button
				type="button"
				{disabled}
				class="flex items-center gap-3 rounded-2xl border-2 p-3 text-left disabled:opacity-35 {selected === t.id ? 'border-ink bg-task-soft' : 'border-line bg-surface'}"
				onclick={() => (selected = t.id)}
			>
				<span class="grid size-12 place-items-center rounded-xl {selected === t.id ? 'bg-task text-task-ink' : 'bg-bg'}"><CarrierIcon kind={t.kind} class="size-6" /></span>
				<span class="flex-1">
					<span class="block font-bold">{t.name}</span>
					<span class="block text-sm text-muted">{t.lengthCm}×{t.widthCm}×{t.heightCm} cm</span>
				</span>
			</button>
		{/each}
		<button
			type="button"
			class="flex items-center gap-3 rounded-2xl border-2 p-3 text-left {selected === 'custom' ? 'border-ink bg-task-soft' : 'border-dashed border-line-strong bg-surface'}"
			onclick={() => (selected = 'custom')}
		>
			<span class="grid size-12 place-items-center rounded-xl {selected === 'custom' ? 'bg-task text-task-ink' : 'bg-bg'}"><Ruler class="size-6" /></span>
			<span class="flex-1">
				<span class="block font-bold">Własny nośnik</span>
				<span class="block text-sm text-muted">Podaj nazwę i wymiary</span>
			</span>
		</button>
	</div>

	{#if selected === 'custom'}
		<div class="mt-4 grid grid-cols-3 gap-2">
			<div class="col-span-3 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
				{#each kinds as k}
					<button
						type="button"
						disabled={lockedKind !== null && k.id !== lockedKind}
						class="h-10 rounded-lg text-sm font-bold disabled:opacity-35 {custom.kind === k.id ? 'bg-surface shadow-sm' : 'text-muted'}"
						onclick={() => (custom.kind = k.id)}>{k.label}</button
					>
				{/each}
			</div>
			<label class="col-span-3 text-sm font-semibold">
				Nazwa
				<input bind:value={custom.name} class="mt-1 h-11 w-full rounded-xl border border-line-strong px-3 font-normal outline-none focus:border-ink" placeholder={custom.kind === 'PALLET' ? 'np. Paleta dłużycowa' : 'np. Karton XL'} />
			</label>
			{#each dimFields as f}
				<label class="text-sm font-semibold">
					{f.label}
					<input type="number" inputmode="numeric" bind:value={custom[f.key]} class="mt-1 h-11 w-full rounded-xl border border-line-strong px-3 font-mono font-normal outline-none focus:border-ink" />
				</label>
			{/each}
			<label class="col-span-3 text-sm font-semibold">
				Waga nośnika (tara), kg
				<input type="number" inputmode="decimal" bind:value={custom.tareKg} class="mt-1 h-11 w-full rounded-xl border border-line-strong px-3 font-mono font-normal outline-none focus:border-ink" />
			</label>
		</div>
	{/if}

	{#if forwarder}
		<p class="mt-4 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-info">
			{selectedKind === 'PALLET' ? 'Palety' : 'Paczki'} → spedytor <b>{forwarder.name}</b>
		</p>
	{/if}

	{#snippet footer()}
		<Button variant="primary" size="lg" loading={busy} onclick={submit}><Printer class="size-5" />Dodaj i drukuj etykietę</Button>
	{/snippet}
</Sheet>
