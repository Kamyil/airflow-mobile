<script lang="ts">
	import '../app.css';
	import { beforeNavigate } from '$app/navigation';
	import { navigating, updated } from '$app/state';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();

	// Po wdrożeniu nowej wersji stare pliki JS znikają z serwera – zamiast błędu 500
	// przy następnej nawigacji ładujemy stronę od nowa (dane makiety są w localStorage, nic nie ginie).
	beforeNavigate(({ willUnload, to, cancel }) => {
		if (updated.current && !willUnload && to?.url) {
			cancel();
			location.href = to.url.href;
		}
	});
</script>

{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-task/30">
		<div class="progress-slide h-full w-1/3 bg-task"></div>
	</div>
{/if}

<Toaster />

{@render children()}
