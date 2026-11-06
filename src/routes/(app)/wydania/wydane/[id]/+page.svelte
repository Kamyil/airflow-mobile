<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { addShipmentPhotos, sendShipmentEmail, withdrawOrders } from '$lib/api';
	import { toast } from '$lib/toast.svelte';
	import { fmtDateTime, fmtKg } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';
	import CarrierCode from '$lib/components/CarrierCode.svelte';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import FileText from '@lucide/svelte/icons/file-text';
	import Camera from '@lucide/svelte/icons/camera';
	import Mail from '@lucide/svelte/icons/mail';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Send from '@lucide/svelte/icons/send';

	let { data } = $props();
	let s = $derived(data.shipment);
	let busy = $state(false);

	async function run(fn: () => Promise<void>, msg: string) {
		busy = true;
		try {
			await fn();
			toast.ok(msg);
			await invalidateAll();
			return true;
		} catch (e) {
			toast.error(e);
			return false;
		} finally {
			busy = false;
		}
	}

	// --- zdjęcia ---
	let photosOpen = $state(false);
	let newPhotos = $state<string[]>([]);
	async function savePhotos() {
		if (await run(() => addShipmentPhotos(s.id, newPhotos), `Dodano zdjęcia (${newPhotos.length})`)) {
			photosOpen = false;
			newPhotos = [];
		}
	}

	// --- e-mail ---
	let mailOpen = $state(false);
	let mailGroups = $state<string[]>([]);
	async function sendMail() {
		if (await run(() => sendShipmentEmail(s.id, mailGroups), 'Podsumowanie wysłane')) mailOpen = false;
	}

	// --- wycofanie ---
	let withdrawOpen = $state(false);
	let toWithdraw = $state<string[]>([]);
	async function withdraw() {
		if (await run(() => withdrawOrders(s.id, toWithdraw), 'Zamówienia wycofane – wróciły do „Do wydania”')) {
			withdrawOpen = false;
			toWithdraw = [];
		}
	}
	let active = $derived(s.orders.filter((o) => !o.withdrawn));
	let preview = $state<string | null>(null);
</script>

<PageHeader title={s.number} subtitle="{s.forwarder.name} · {s.dock}" back="/wydania/wydane" />

<div class="flex flex-col gap-3 p-3">
	{#if data.fresh}
		<section class="flex items-center gap-3 rounded-2xl bg-ok p-4 text-white">
			<CircleCheckBig class="size-8 shrink-0" />
			<div><p class="font-extrabold">Wydanie zakończone</p><p class="text-sm text-white/80">Auto może odjechać.</p></div>
		</section>
	{/if}

	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
			<div><dt class="text-xs text-muted">Zamknięto</dt><dd class="font-semibold">{fmtDateTime(s.closedAt)}</dd></div>
			<div><dt class="text-xs text-muted">Wydał(a)</dt><dd class="font-semibold">{s.operator}</dd></div>
			<div><dt class="text-xs text-muted">Kierowca</dt><dd class="font-semibold">{s.driver.name}</dd></div>
			<div><dt class="text-xs text-muted">Auto</dt><dd class="font-mono font-semibold">{s.driver.plate}</dd></div>
			<div class="col-span-2"><dt class="text-xs text-muted">List przewozowy</dt><dd class="flex items-center gap-1.5 font-mono font-semibold"><FileText class="size-4 text-muted" />{s.waybillNo}</dd></div>
			<div class="col-span-2"><dt class="text-xs text-muted">Ładunek</dt><dd class="font-semibold">{s.carriers} nośn. · {fmtKg(s.weightKg)}</dd></div>
		</dl>
		{#if s.driver.signature}<img src={s.driver.signature} alt="Podpis kierowcy" class="mt-3 h-20 rounded-xl border border-line bg-bg object-contain" />{/if}
	</section>

	<section>
		<h2 class="mb-2 px-1 text-xs font-extrabold tracking-wide text-muted uppercase">Zamówienia ({s.orders.length})</h2>
		<ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			{#each s.orders as o (o.id)}
				<li class="border-t border-line p-3 first:border-0 {o.withdrawn ? 'opacity-60' : ''}">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0"><p class="font-mono text-sm font-bold {o.withdrawn ? 'line-through' : ''}">{o.number}</p><p class="truncate text-sm text-ink-2">{o.customer}</p></div>
						{#if o.withdrawn}<Badge tone="warn"><Undo2 />Wycofane</Badge>{/if}
					</div>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each o.carriers as c (c.id)}<span class="inline-flex h-7 items-center rounded-lg border border-line bg-bg px-2 text-xs"><CarrierCode code={c.code} /></span>{/each}
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<div class="flex items-center justify-between">
			<p class="flex items-center gap-2 text-sm font-bold"><Camera class="size-4" />Zdjęcia ({s.photos.length})</p>
			<Button size="sm" onclick={() => (photosOpen = true)}>Dodaj</Button>
		</div>
		{#if s.photos.length}
			<div class="mt-3 grid grid-cols-3 gap-2">
				{#each s.photos as p (p.id)}<button type="button" class="aspect-square overflow-hidden rounded-xl bg-bg" onclick={() => (preview = p.src)}><img src={p.src} alt="" class="size-full object-cover" /></button>{/each}
			</div>
		{/if}
	</section>

	<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
		<div class="flex items-center justify-between">
			<p class="flex items-center gap-2 text-sm font-bold"><Mail class="size-4" />E-mail z podsumowaniem</p>
			<Button size="sm" onclick={() => ((mailGroups = []), (mailOpen = true))}>Wyślij</Button>
		</div>
		<ul class="mt-2 flex flex-col gap-1 text-xs text-muted">
			{#each s.emailLog as e, i (i)}<li><b class="text-ink-2">{fmtDateTime(e.sentAt)}</b> → {e.groups.join(', ')}</li>{:else}<li>Nie wysłano</li>{/each}
		</ul>
	</section>

	{#if active.length}
		<Button variant="danger" size="lg" onclick={() => ((toWithdraw = []), (withdrawOpen = true))}><Undo2 class="size-5" />Wycofaj zamówienia z wydania</Button>
	{/if}
</div>

<Sheet bind:open={photosOpen} title="Dodaj zdjęcia" description={s.number}>
	<PhotoCapture bind:photos={newPhotos} />
	{#snippet footer()}<Button variant="primary" size="lg" disabled={!newPhotos.length} loading={busy} onclick={savePhotos}>Zapisz zdjęcia</Button>{/snippet}
</Sheet>

<Sheet bind:open={mailOpen} title="Wyślij podsumowanie" description={s.number}>
	{#each data.emailGroups as e (e.id)}
		<label class="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
			<input type="checkbox" class="mt-1 size-5 accent-ink" checked={mailGroups.includes(e.id)} onchange={() => (mailGroups = mailGroups.includes(e.id) ? mailGroups.filter((x) => x !== e.id) : [...mailGroups, e.id])} />
			<span><b class="block text-sm">{e.name}</b><span class="text-xs text-muted">{e.emails.join(', ')}</span></span>
		</label>
	{/each}
	{#snippet footer()}<Button variant="primary" size="lg" disabled={!mailGroups.length} loading={busy} onclick={sendMail}><Send class="size-5" />Wyślij</Button>{/snippet}
</Sheet>

<Sheet bind:open={withdrawOpen} title="Wycofaj z wydania" description="Zaznacz zamówienia, które nie pojechały. Wrócą do „Do wydania”.">
	{#each active as o (o.id)}
		<label class="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
			<input type="checkbox" class="mt-1 size-5 accent-ink" checked={toWithdraw.includes(o.id)} onchange={() => (toWithdraw = toWithdraw.includes(o.id) ? toWithdraw.filter((x) => x !== o.id) : [...toWithdraw, o.id])} />
			<span><b class="block font-mono text-sm">{o.number}</b><span class="text-xs text-muted">{o.customer} · {o.carriers.length} nośn.</span></span>
		</label>
	{/each}
	{#snippet footer()}<Button variant="danger" size="lg" disabled={!toWithdraw.length} loading={busy} onclick={withdraw}><Undo2 class="size-5" />Wycofaj ({toWithdraw.length})</Button>{/snippet}
</Sheet>

{#if preview}
	<button type="button" class="fixed inset-0 z-[60] grid place-items-center bg-ink/90 p-4" onclick={() => (preview = null)}><img src={preview} alt="" class="max-h-full max-w-full rounded-xl" /></button>
{/if}
