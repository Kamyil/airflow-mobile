<script lang="ts">
	import '../app.css';
	import { navigating } from '$app/state';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();
</script>

{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-task/30">
		<div class="progress-slide h-full w-1/3 bg-task"></div>
	</div>
{/if}

<Toaster />

{@render children()}
