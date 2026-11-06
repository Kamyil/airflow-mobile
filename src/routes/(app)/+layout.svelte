<script lang="ts">
	import { page } from '$app/state';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Truck from '@lucide/svelte/icons/truck';

	let { data, children } = $props();

	// Ekrany robocze (kompletacja konkretnego zlecenia, edycja nośnika) mają własny pasek akcji na dole
	let isWorkScreen = $derived(page.route.id?.startsWith('/(app)/kompletacja/[id]') ?? false);

	let tabs = $derived([
		{ href: '/kompletacja', label: 'Kompletacja', icon: ClipboardList, count: data.context.counts.picking, active: page.url.pathname.startsWith('/kompletacja') },
		{ href: '/wysylka/przygotowanie', label: 'Wysyłka', icon: Truck, count: data.context.counts.dispatch, active: page.url.pathname.startsWith('/wysylka') }
	]);
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg shadow-[0_0_0_1px_var(--color-line)]">
	<div class="flex flex-1 flex-col {isWorkScreen ? '' : 'pb-24'}">
		{@render children()}
	</div>

	{#if !isWorkScreen}
		<nav class="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-surface">
			<div class="grid grid-cols-2">
				{#each tabs as tab}
					{@const Icon = tab.icon}
					<a href={tab.href} class="relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold {tab.active ? 'text-ink' : 'text-muted'}">
						{#if tab.active}<span class="absolute top-0 h-1 w-12 rounded-b-full bg-task"></span>{/if}
						<span class="relative">
							<Icon class="size-6" strokeWidth={tab.active ? 2.4 : 2} />
							{#if tab.count > 0}
								<span class="absolute -top-1.5 -right-3 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-ink px-1 text-[10px] leading-none text-white">{tab.count}</span>
							{/if}
						</span>
						{tab.label}
					</a>
				{/each}
			</div>
		</nav>
	{/if}
</div>
