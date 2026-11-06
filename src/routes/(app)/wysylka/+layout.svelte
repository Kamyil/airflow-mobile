<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppMenu from '$lib/components/AppMenu.svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/wysylka/przygotowanie', label: 'Przygotowanie' },
		{ href: '/wysylka/zamkniecie', label: 'Zamknięcie' }
	];
</script>

<PageHeader title="Wysyłka" subtitle="Przygotowanie i zamknięcie dnia">
	{#snippet actions()}<AppMenu />{/snippet}
	{#snippet below()}
		<div class="px-3 pb-3">
			<div class="grid grid-cols-2 rounded-xl bg-white/10 p-1">
				{#each tabs as tab}
					{@const active = page.url.pathname.startsWith(tab.href)}
					<a href={tab.href} class="grid h-10 place-items-center rounded-lg text-sm font-bold {active ? 'bg-task text-task-ink' : 'text-white/75'}">{tab.label}</a>
				{/each}
			</div>
		</div>
	{/snippet}
</PageHeader>

{@render children()}
