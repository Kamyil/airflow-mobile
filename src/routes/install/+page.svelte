<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	/** Instalacja PWA (jak /install w dok-app) */
	type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
	let deferred = $state<InstallPrompt | null>(null);
	let installed = $state(false);
	let standalone = $state(typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches);

	$effect(() => {
		let done = () => (installed = true);
		window.addEventListener('appinstalled', done);
		return () => window.removeEventListener('appinstalled', done);
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		let { outcome } = await deferred.userChoice;
		if (outcome === 'accepted') installed = true;
		deferred = null;
	}
</script>

<svelte:window
	onbeforeinstallprompt={(e) => {
		e.preventDefault();
		deferred = e as unknown as InstallPrompt;
	}}
/>

<svelte:head><title>Instalacja · Airflow Magazyn</title></svelte:head>

<main class="mx-auto min-h-dvh w-full max-w-md bg-bg">
	<header class="pt-safe bg-ink px-2 text-white">
		<div class="flex min-h-16 items-center gap-1">
			<a href="/" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Wróć"><ArrowLeft class="size-6" /></a>
			<h1 class="text-lg font-extrabold">Zainstaluj aplikację</h1>
		</div>
	</header>

	<div class="flex flex-col gap-3 p-4">
		<div class="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
			<img src="/icon.svg" alt="" class="size-14 rounded-2xl" />
			<div>
				<p class="text-lg font-extrabold">Airflow Magazyn</p>
				<p class="text-sm text-muted">Aplikacja na telefon magazyniera – działa także bez zasięgu.</p>
			</div>
		</div>

		{#if standalone || installed}
			<p class="flex items-center gap-2 rounded-2xl bg-ok-soft p-4 font-bold text-ok"><CircleCheck class="size-5" />Aplikacja jest zainstalowana</p>
		{:else if deferred}
			<Button variant="task" size="xl" onclick={install}><Download class="size-6" />Zainstaluj</Button>
		{/if}

		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<h2 class="font-extrabold">Android (Chrome)</h2>
			<ol class="mt-2 flex flex-col gap-2 text-sm">
				<li class="flex gap-2"><EllipsisVertical class="size-5 shrink-0 text-muted" />Otwórz menu przeglądarki (⋮)</li>
				<li class="flex gap-2"><Download class="size-5 shrink-0 text-muted" />Wybierz „Zainstaluj aplikację”</li>
			</ol>
		</section>
		<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
			<h2 class="font-extrabold">iPhone (Safari)</h2>
			<ol class="mt-2 flex flex-col gap-2 text-sm">
				<li class="flex gap-2"><Share class="size-5 shrink-0 text-muted" />Stuknij „Udostępnij”</li>
				<li class="flex gap-2"><SquarePlus class="size-5 shrink-0 text-muted" />Wybierz „Do ekranu początkowego”</li>
			</ol>
		</section>
	</div>
</main>
