<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import User from '@lucide/svelte/icons/user';
	import KeyRound from '@lucide/svelte/icons/key-round';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Logowanie · MWS Magazyn</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ink text-white">
	<div class="pt-safe flex flex-1 flex-col justify-end px-6 pb-8">
		<img src="/icon.svg" alt="" class="size-16 rounded-2xl" />
		<h1 class="mt-5 text-3xl leading-tight font-extrabold">MWS Magazyn</h1>
		<p class="mt-1 text-white/65">Kompletacja nośników i wysyłka</p>
	</div>

	<form
		method="POST"
		class="pb-safe rounded-t-3xl bg-surface px-6 pt-7 text-ink"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<h2 class="text-xl font-extrabold">Zaloguj się</h2>
		<label class="mt-5 block text-sm font-semibold">
			Login
			<span class="mt-1 flex h-13 items-center gap-2 rounded-xl border-2 border-line-strong px-3 focus-within:border-ink">
				<User class="size-5 text-muted" />
				<input name="login" value={form?.login ?? ''} autocomplete="username" autocapitalize="none" required class="h-full flex-1 bg-transparent text-base font-normal outline-none" />
			</span>
		</label>
		<label class="mt-3 block text-sm font-semibold">
			Hasło
			<span class="mt-1 flex h-13 items-center gap-2 rounded-xl border-2 border-line-strong px-3 focus-within:border-ink">
				<KeyRound class="size-5 text-muted" />
				<input name="password" type="password" autocomplete="current-password" required class="h-full flex-1 bg-transparent text-base font-normal outline-none" />
			</span>
		</label>
		{#if form?.error}
			<p class="mt-3 flex items-center gap-2 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><TriangleAlert class="size-4 shrink-0" />{form.error}</p>
		{/if}
		<Button type="submit" variant="primary" size="lg" class="mt-5 mb-6 w-full" loading={busy}>Zaloguj się</Button>
	</form>
</main>
