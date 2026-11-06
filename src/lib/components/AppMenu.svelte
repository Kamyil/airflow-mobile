<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { logoutOperator, resetMockData } from '$lib/api';
	import { connectivity } from '$lib/connectivity.svelte';
	import { toast } from '$lib/toast.svelte';
	import { fmtTime, plural } from '$lib/format';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRoundCog from '@lucide/svelte/icons/user-round-cog';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Wifi from '@lucide/svelte/icons/wifi';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import Send from '@lucide/svelte/icons/send';

	let open = $state(false);
	let busy = $state(false);
	let device = $derived(page.data.context?.operator);
	let operator = $derived(page.data.operator);

	async function reset() {
		if (!confirm('Przywrócić dane makiety do stanu początkowego?')) return;
		busy = true;
		await resetMockData();
		busy = false;
		open = false;
		toast.info('Dane makiety zresetowane');
		await goto('/');
		await invalidateAll();
	}

	function switchOperator() {
		logoutOperator();
		open = false;
		goto('/pin');
	}

	async function toggleOffline() {
		connectivity.simulatedOffline = !connectivity.simulatedOffline;
		if (connectivity.online) {
			let sent = await connectivity.flush();
			if (sent) toast.ok('Połączenie przywrócone', `Wysłano ${sent} ${plural(sent, 'operację', 'operacje', 'operacji')} z kolejki.`);
		} else toast.warn('Tryb offline', 'Operacje zapisują się lokalnie i trafią do kolejki.');
	}
</script>

<button type="button" class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Menu operatora" onclick={() => (open = true)}>
	<CircleUser class="size-6" />
</button>

<Sheet bind:open title={operator?.name ?? 'Operator'} description={operator?.role === 'KIEROWNIK' ? 'Kierownik zmiany' : 'Magazynier'}>
	<dl class="divide-y divide-line rounded-xl border border-line text-sm">
		<div class="flex justify-between gap-4 px-4 py-3"><dt class="text-muted">Urządzenie</dt><dd class="font-semibold">{device?.device}</dd></div>
		<div class="flex justify-between gap-4 px-4 py-3"><dt class="text-muted">Drukarka</dt><dd class="text-right font-semibold">{device?.printer}</dd></div>
		<div class="flex items-center justify-between gap-4 px-4 py-3">
			<dt class="text-muted">Połączenie</dt>
			<dd class="flex items-center gap-1.5 font-semibold {connectivity.online ? 'text-ok' : 'text-warn'}">
				{#if connectivity.online}<Wifi class="size-4" />Online{:else}<WifiOff class="size-4" />Offline{/if}
			</dd>
		</div>
	</dl>

	{#if connectivity.outbox.length}
		<div class="mt-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
			<p class="flex items-center gap-2 font-bold"><Send class="size-4" />Do wysłania: {connectivity.outbox.length}</p>
			<ul class="mt-1.5 flex max-h-32 flex-col gap-0.5 overflow-y-auto text-xs">
				{#each connectivity.outbox as o (o.id)}<li class="flex justify-between gap-2"><span>{o.label}</span><span class="font-mono">{fmtTime(o.at)}</span></li>{/each}
			</ul>
		</div>
	{/if}

	<div class="mt-3 grid grid-cols-2 gap-2">
		<Button onclick={switchOperator}><UserRoundCog class="size-4" />Zmień operatora</Button>
		<Button href="/install"><Smartphone class="size-4" />Instalacja</Button>
	</div>
	<a href="/logout" data-sveltekit-reload class="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong font-semibold"><LogOut class="size-4" />Wyloguj urządzenie</a>

	<p class="mt-5 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Makieta</p>
	<div class="flex flex-col gap-2">
		<Button onclick={toggleOffline}>
			{#if connectivity.simulatedOffline}<Wifi class="size-4" />Przywróć połączenie{:else}<WifiOff class="size-4" />Symuluj brak sieci{/if}
		</Button>
		<Button variant="danger" loading={busy} onclick={reset}><RotateCcw class="size-4" />Resetuj dane do stanu początkowego</Button>
	</div>
</Sheet>
