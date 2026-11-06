<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		value: number;
		min?: number;
		max: number;
		unit?: string;
		size?: 'md' | 'lg';
		class?: string;
	}
	let { value = $bindable(), min = 0, max, unit, size = 'md', class: classes = '' }: Props = $props();

	const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
	let btn = $derived(size === 'lg' ? 'size-14' : 'size-11');
</script>

<div class={twMerge('flex items-center gap-2', classes)}>
	<button type="button" class="{btn} grid shrink-0 place-items-center rounded-xl border border-line-strong bg-surface disabled:opacity-30" disabled={value <= min} onclick={() => (value = clamp(value - 1))} aria-label="Mniej">
		<Minus class="size-5" />
	</button>
	<label class="relative flex-1">
		<input
			type="number"
			inputmode="numeric"
			class="w-full rounded-xl border border-line-strong bg-surface text-center font-mono font-bold tabular-nums outline-none focus:border-ink {size === 'lg' ? 'h-14 text-2xl' : 'h-11 text-lg'}"
			{min}
			{max}
			bind:value
			onchange={() => (value = clamp(value))}
		/>
		{#if unit}<span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">{unit}</span>{/if}
	</label>
	<button type="button" class="{btn} grid shrink-0 place-items-center rounded-xl border border-line-strong bg-surface disabled:opacity-30" disabled={value >= max} onclick={() => (value = clamp(value + 1))} aria-label="Więcej">
		<Plus class="size-5" />
	</button>
</div>
