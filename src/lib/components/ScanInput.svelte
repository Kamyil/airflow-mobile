<script lang="ts">
	import { tick } from 'svelte';
	import { twMerge } from 'tailwind-merge';
	import Button from './Button.svelte';
	import CameraScanner from './CameraScanner.svelte';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Camera from '@lucide/svelte/icons/camera';
	import { beep } from '$lib/feedback';

	/**
	 * Pole skanu: skaner sprzętowy działa jak klawiatura (kod + Enter), do tego kamera
	 * i – tylko w makiecie – podpowiedzi "symuluj skan" z poprawnymi kodami.
	 * `onScan` zwraca komunikat błędu (string) albo nic, gdy skan jest poprawny.
	 */
	interface Props {
		placeholder?: string;
		onScan: (code: string) => Promise<string | null | void> | string | null | void;
		hints?: { code: string; label?: string }[];
		busy?: boolean;
		autofocus?: boolean;
		class?: string;
	}
	let { placeholder = 'Zeskanuj kod', onScan, hints = [], busy = false, autofocus = true, class: classes = '' }: Props = $props();

	let value = $state('');
	let error = $state<string | null>(null);
	let cameraOpen = $state(false);
	let working = $state(false);

	export async function submit(code = value) {
		let c = code.trim();
		if (!c || working) return;
		working = true;
		error = null;
		try {
			let err = await onScan(c.toUpperCase());
			if (err) {
				error = err;
				beep('bad');
			} else {
				value = '';
				beep('ok');
			}
		} finally {
			working = false;
		}
	}

	function focus(node: HTMLInputElement) {
		if (autofocus) tick().then(() => node.focus({ preventScroll: true }));
	}
</script>

<div class={classes}>
	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<label class={twMerge('flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 bg-surface px-3', error ? 'border-bad' : 'border-ink')}>
			<ScanLine class="size-5 shrink-0 text-muted" />
			<input
				{@attach focus}
				bind:value
				class="h-full min-w-0 flex-1 bg-transparent font-mono text-lg font-bold uppercase outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:normal-case"
				{placeholder}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				enterkeyhint="done"
			/>
		</label>
		<Button size="icon" class="size-14 shrink-0" aria-label="Skanuj kamerą" onclick={() => (cameraOpen = true)}><Camera class="size-6" /></Button>
		<Button type="submit" variant="primary" size="lg" class="h-14 px-4" loading={busy || working}>OK</Button>
	</form>

	{#if error}<p class="mt-2 text-sm font-bold text-bad">{error}</p>{/if}

	{#if hints.length}
		<div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-line-strong pt-2 text-xs text-muted">
			<span>Makieta – symuluj skan:</span>
			{#each hints as h (h.code)}
				<button type="button" class="rounded-md bg-ink/6 px-2 py-1 font-mono active:bg-task-soft" onclick={() => submit(h.code)}>{h.label ?? h.code}</button>
			{/each}
		</div>
	{/if}
</div>

<CameraScanner bind:open={cameraOpen} onDetect={(code) => submit(code)} />
