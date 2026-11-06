<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	interface Props {
		title: string;
		subtitle?: string;
		back?: string;
		actions?: Snippet;
		below?: Snippet;
	}
	let { title, subtitle, back, actions, below }: Props = $props();
</script>

<header class="pt-safe sticky top-0 z-30 bg-ink text-white">
	<div class="flex min-h-16 items-center gap-1 px-2">
		{#if back}
			<a href={back} class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Wróć">
				<ArrowLeft class="size-6" />
			</a>
		{:else}
			<div class="w-2"></div>
		{/if}
		<div class="min-w-0 flex-1 py-2">
			<h1 class="truncate text-lg leading-tight font-extrabold">{title}</h1>
			{#if subtitle}<p class="truncate text-[13px] text-white/65">{subtitle}</p>{/if}
		</div>
		{@render actions?.()}
	</div>
	{@render below?.()}
</header>
