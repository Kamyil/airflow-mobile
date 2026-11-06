<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sheet from './Sheet.svelte';
	import PinPad from './PinPad.svelte';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	/**
	 * Zatwierdzenie przez przełożonego na miejscu: lista rozbieżności, uwaga i PIN kierownika.
	 * `onConfirm` zwraca komunikat błędu albo null.
	 */
	interface Props {
		open: boolean;
		title: string;
		description?: string;
		busy?: boolean;
		children: Snippet;
		onConfirm: (pin: string, note: string) => Promise<string | null>;
		extra?: Snippet;
	}
	let { open = $bindable(), title, description, busy = false, children, onConfirm, extra }: Props = $props();

	let note = $state('');
	let error = $state<string | null>(null);

	async function confirm(pin: string) {
		error = await onConfirm(pin, note);
	}
</script>

<Sheet bind:open {title} {description}>
	{@render children()}
	<label class="mt-4 block text-sm font-semibold">
		Uwaga przełożonego
		<textarea bind:value={note} rows="2" class="mt-1 w-full rounded-xl border-2 border-line-strong p-3 text-base font-normal outline-none focus:border-ink" placeholder="np. reklamacja zgłoszona dostawcy"></textarea>
	</label>
	<div class="mt-4 rounded-2xl bg-bg p-4">
		<p class="mb-3 flex items-center justify-center gap-2 text-sm font-bold"><ShieldCheck class="size-5 text-info" />PIN przełożonego</p>
		<PinPad {error} {busy} onComplete={confirm} />
		<p class="mt-3 text-center text-xs text-muted">Makieta: PIN kierownika <b class="font-mono">9999</b></p>
	</div>
	{#if extra}
		<div class="mt-3 flex flex-col gap-2">{@render extra()}</div>
	{/if}
</Sheet>
