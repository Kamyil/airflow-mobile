<script lang="ts">
	import { goto } from '$app/navigation';
	import { ApiError, loginWithPin } from '$lib/api';
	import PinPad from '$lib/components/PinPad.svelte';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Smartphone from '@lucide/svelte/icons/smartphone';

	let { data } = $props();
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(pin: string) {
		busy = true;
		error = null;
		try {
			await loginWithPin(pin);
			await goto(data.next.startsWith('/') ? data.next : '/');
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Błąd weryfikacji PIN';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>PIN · Airflow Magazyn</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ink text-white">
	<div class="pt-safe flex items-center justify-between px-4 pt-4 text-sm text-white/65">
		<span class="flex items-center gap-2"><Smartphone class="size-4" />{data.user?.name ?? 'Urządzenie'}</span>
		<a href="/logout" data-sveltekit-reload class="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-white/10"><LogOut class="size-4" />Wyloguj urządzenie</a>
	</div>
	<div class="flex flex-1 flex-col justify-end px-6 pb-6">
		<img src="/icon.svg" alt="" class="size-14 rounded-2xl" />
		<h1 class="mt-4 text-2xl font-extrabold">Kto pracuje na urządzeniu?</h1>
		<p class="mt-1 text-white/65">Wpisz swój 4-cyfrowy PIN.</p>
	</div>
	<section class="pb-safe rounded-t-3xl bg-bg px-6 pt-8 pb-6 text-ink">
		<PinPad {error} {busy} onComplete={submit} />
		<div class="mt-6 rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted">
			<p class="mb-1 font-bold">Makieta – konta operatorów:</p>
			<ul class="grid grid-cols-2 gap-x-3 gap-y-0.5">
				{#each data.operators as op (op.id)}
					<li>{op.name} {op.role === 'KIEROWNIK' ? '(kier.)' : ''}</li>
				{/each}
			</ul>
			<p class="mt-1">PIN-y: 1111, 2222, 3333, kierownik 9999</p>
		</div>
	</section>
</main>
