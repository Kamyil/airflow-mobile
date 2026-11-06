<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { finalizeDispatch } from '$lib/api';
	import { toast } from '$lib/toast.svelte';
	import { fmtKg } from '$lib/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';
	import SignaturePad from '$lib/components/SignaturePad.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';

	let { data } = $props();
	let g = $derived(data.group);
	let going = $derived(g?.orders.filter((o) => o.ready && o.carriersLoaded === o.carriersTotal) ?? []);
	let staying = $derived(g?.orders.filter((o) => !(o.ready && o.carriersLoaded === o.carriersTotal)) ?? []);

	let photos = $state<string[]>([]);
	let driverName = $state('');
	let plate = $state('');
	let signature = $state<string | null>(null);
	let emailGroupIds = $state<string[]>(untrack(() => data.emailGroups.filter((e) => e.always || e.forwarderId === data.forwarderId).map((e) => e.id)));
	let busy = $state(false);

	function toggle(id: string) {
		emailGroupIds = emailGroupIds.includes(id) ? emailGroupIds.filter((x) => x !== id) : [...emailGroupIds, id];
	}

	async function submit() {
		if (!g) return;
		busy = true;
		try {
			let { shipmentId, number } = await finalizeDispatch(g.forwarder.id, { driverName, plate, signature, photos, emailGroupIds });
			toast.ok(`Wydanie ${number} zakończone`, emailGroupIds.length ? 'Podsumowanie wysłane e-mailem.' : undefined);
			await goto(`/wydania/wydane/${shipmentId}?nowe`);
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}
</script>

<PageHeader title="Zakończ wydanie" subtitle={g ? `${g.forwarder.name} · ${g.dock}` : ''} back="/wydania/{data.forwarderId}" />

{#if !g || !going.length}
	<div class="p-3"><Empty>Nic nie jest załadowane.</Empty></div>
{:else}
	<div class="flex flex-col gap-3 p-3 pb-28">
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="text-xs font-bold tracking-wide text-muted uppercase">Jedzie ({going.length} zam. · {going.reduce((n, o) => n + o.carriersTotal, 0)} nośn. · {fmtKg(g.weightLoadedKg)})</p>
			<ul class="mt-2 flex flex-col gap-1 text-sm">
				{#each going as o (o.salesOrder.id)}<li class="flex items-center gap-2"><CircleCheck class="size-4 text-ok" /><b class="font-mono">{o.salesOrder.number}</b><span class="truncate text-muted">{o.customer.name}</span></li>{/each}
			</ul>
			{#if staying.length}
				<p class="mt-3 text-xs font-bold tracking-wide text-muted uppercase">Zostaje na kolejne wydanie</p>
				<ul class="mt-1 flex flex-col gap-1 text-sm text-muted">
					{#each staying as o (o.salesOrder.id)}<li class="flex items-center gap-2"><Hourglass class="size-4" /><span class="font-mono">{o.salesOrder.number}</span></li>{/each}
				</ul>
			{/if}
		</section>

		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="mb-2 text-sm font-bold">Zdjęcia załadunku</p>
			<PhotoCapture bind:photos />
		</section>

		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="text-sm font-bold">Kierowca</p>
			<div class="mt-2 grid grid-cols-[1fr_9rem] gap-2">
				<input bind:value={driverName} class="h-12 min-w-0 rounded-xl border-2 border-line-strong px-3 outline-none focus:border-ink" placeholder="Imię i nazwisko" autocomplete="off" />
				<input bind:value={plate} class="h-12 min-w-0 rounded-xl border-2 border-line-strong px-3 font-mono uppercase outline-none focus:border-ink" placeholder="Nr rej." autocapitalize="characters" autocomplete="off" />
			</div>
			<div class="mt-3"><SignaturePad bind:value={signature} /></div>
		</section>

		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<p class="flex items-center gap-2 text-sm font-bold"><Mail class="size-4" />Wyślij podsumowanie do</p>
			<ul class="mt-2 flex flex-col">
				{#each data.emailGroups as e (e.id)}
					<li>
						<label class="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
							<input type="checkbox" class="mt-1 size-5 accent-ink" checked={emailGroupIds.includes(e.id)} onchange={() => toggle(e.id)} />
							<span><b class="block text-sm">{e.name}</b><span class="text-xs text-muted">{e.emails.join(', ')}</span></span>
						</label>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<div class="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-surface/95 px-3 pt-3 backdrop-blur">
		<div class="pb-3"><Button variant="ok" size="lg" class="w-full" loading={busy} onclick={submit}><Lock class="size-5" />Zakończ wydanie</Button></div>
	</div>
{/if}
