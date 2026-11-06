<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	let { value = $bindable(), placeholder = 'Szukaj…' }: { value: string; placeholder?: string } = $props();
</script>

<label class="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-ink">
	<Search class="size-5 text-muted" />
	<input bind:value class="h-full min-w-0 flex-1 bg-transparent outline-none" {placeholder} />
	{#if value}<button type="button" class="grid size-7 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Wyczyść" onclick={() => (value = '')}><X class="size-4" /></button>{/if}
</label>
