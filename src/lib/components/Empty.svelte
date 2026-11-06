<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">{@render children()}</div>
