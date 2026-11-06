<script lang="ts">
	import Delete from '@lucide/svelte/icons/delete';

	/** Klawiatura PIN (4 cyfry) – jak w dok-app. Po wpisaniu 4 cyfr woła `onComplete`. */
	interface Props {
		length?: number;
		error?: string | null;
		busy?: boolean;
		onComplete: (pin: string) => void;
	}
	let { length = 4, error = null, busy = false, onComplete }: Props = $props();

	let pin = $state('');

	export function clear() {
		pin = '';
	}

	function press(d: string) {
		if (busy || pin.length >= length) return;
		pin += d;
		if (pin.length === length) {
			let value = pin;
			setTimeout(() => {
				onComplete(value);
				pin = '';
			}, 120);
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (/^\d$/.test(e.key)) press(e.key);
		else if (e.key === 'Backspace') pin = pin.slice(0, -1);
	}}
/>

<div class="flex flex-col items-center">
	<div class="flex gap-3 {error ? 'animate-[shake_0.3s]' : ''}" aria-label="PIN">
		{#each Array.from({ length }, (_, i) => i) as i (i)}
			<span class="size-4 rounded-full border-2 {i < pin.length ? 'border-ink bg-ink' : error ? 'border-bad' : 'border-line-strong'}"></span>
		{/each}
	</div>
	<p class="mt-3 h-5 text-sm font-bold text-bad">{error ?? ''}</p>
	<div class="mt-2 grid w-full max-w-72 grid-cols-3 gap-2">
		{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
			<button type="button" class="h-15 rounded-2xl bg-surface text-2xl font-bold ring-1 ring-line active:bg-task-soft" onclick={() => press(d)}>{d}</button>
		{/each}
		<span></span>
		<button type="button" class="h-15 rounded-2xl bg-surface text-2xl font-bold ring-1 ring-line active:bg-task-soft" onclick={() => press('0')}>0</button>
		<button type="button" class="grid h-15 place-items-center rounded-2xl text-muted active:bg-ink/5" aria-label="Usuń" onclick={() => (pin = pin.slice(0, -1))}><Delete class="size-6" /></button>
	</div>
</div>
