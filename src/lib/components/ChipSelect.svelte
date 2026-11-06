<script lang="ts" generics="T extends string">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Check from '@lucide/svelte/icons/check';
	import Sheet from './Sheet.svelte';

	/** Filtr w postaci "chipa" – po kliknięciu lista opcji w bottom sheecie */
	interface Props {
		label: string;
		value: T | null;
		options: { value: T; label: string; hint?: string }[];
		allLabel?: string;
		onChange: (v: T | null) => void;
	}
	let { label, value, options, allLabel = 'Wszystkie', onChange }: Props = $props();

	let open = $state(false);
	let current = $derived(options.find((o) => o.value === value));

	function pick(v: T | null) {
		open = false;
		onChange(v);
	}
</script>

<button
	type="button"
	class="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border pr-2 pl-3 text-sm font-bold whitespace-nowrap {current ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2'}"
	onclick={() => (open = true)}
>
	{current ? current.label : label}
	<ChevronDown class="size-4 opacity-70" />
</button>

<Sheet bind:open title={label}>
	<ul class="flex flex-col">
		{#each [{ value: null, label: allLabel, hint: undefined }, ...options] as o (o.value ?? '__all')}
			<li>
				<button type="button" class="flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-0" onclick={() => pick(o.value as T | null)}>
					<span class="flex-1">
						<span class="block font-semibold">{o.label}</span>
						{#if o.hint}<span class="block text-xs text-muted">{o.hint}</span>{/if}
					</span>
					{#if o.value === value}<Check class="size-5 text-ok" />{/if}
				</button>
			</li>
		{/each}
	</ul>
</Sheet>
