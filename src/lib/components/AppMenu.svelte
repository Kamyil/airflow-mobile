<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resetMockData } from '$lib/api';
	import { toast } from '$lib/toast.svelte';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import LogOut from '@lucide/svelte/icons/log-out';

	let open = $state(false);
	let busy = $state(false);
	let operator = $derived(page.data.context.operator);
	let user = $derived(page.data.user);

	async function reset() {
		if (!confirm('Przywrócić dane makiety do stanu początkowego?')) return;
		busy = true;
		await resetMockData();
		busy = false;
		open = false;
		toast.info('Dane makiety zresetowane');
		await goto('/kompletacja');
		await invalidateAll();
	}
</script>

<button type="button" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Menu operatora" onclick={() => (open = true)}>
	<CircleUser class="size-6" />
</button>

<Sheet bind:open title={user?.name ?? operator.name} description="Zalogowano jako {user?.login}">
	<dl class="divide-y divide-line rounded-xl border border-line text-sm">
		<div class="flex justify-between gap-4 px-4 py-3"><dt class="text-muted">Urządzenie</dt><dd class="font-semibold">{operator.device}</dd></div>
		<div class="flex justify-between gap-4 px-4 py-3"><dt class="text-muted">Drukarka</dt><dd class="text-right font-semibold">{operator.printer}</dd></div>
	</dl>
	<a href="/logout" data-sveltekit-reload class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong font-semibold"><LogOut class="size-4" />Wyloguj</a>
	<p class="mt-5 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Makieta</p>
	<Button variant="danger" class="w-full" loading={busy} onclick={reset}><RotateCcw class="size-4" />Resetuj dane do stanu początkowego</Button>
</Sheet>
