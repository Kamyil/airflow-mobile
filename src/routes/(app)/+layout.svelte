<script lang="ts">
	import { connectivity } from '$lib/connectivity.svelte';
	import { toast } from '$lib/toast.svelte';
	import { plural } from '$lib/format';

	let { children } = $props();

	async function flush() {
		let sent = await connectivity.flush();
		if (sent) toast.ok('Połączenie przywrócone', `Wysłano ${sent} ${plural(sent, 'operację', 'operacje', 'operacji')} z kolejki.`);
	}
</script>

<svelte:window
	ononline={() => {
		connectivity.browserOnline = true;
		flush();
	}}
	onoffline={() => (connectivity.browserOnline = false)}
/>

<div class="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg shadow-[0_0_0_1px_var(--color-line)]">
	<div class="flex flex-1 flex-col pb-6">
		{@render children()}
	</div>
</div>
