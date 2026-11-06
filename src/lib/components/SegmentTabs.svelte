<script lang="ts">
	import { page } from '$app/state';

	/** Zakładki sekcji pod nagłówkiem (np. Do przyjęcia / W trakcie / Przyjęte) */
	interface Props {
		tabs: { href: string; label: string; count?: number | null }[];
	}
	let { tabs }: Props = $props();

	// aktywna = najdłuższe pasujące href (np. /alokacja vs /alokacja/zakonczone)
	let active = $derived(
		tabs
			.filter((t) => page.url.pathname === t.href || page.url.pathname.startsWith(t.href + '/'))
			.sort((a, b) => b.href.length - a.href.length)[0]?.href
	);
</script>

<div class="px-3 pb-3">
	<div class="grid rounded-xl bg-white/10 p-1" style:grid-template-columns="repeat({tabs.length}, minmax(0, 1fr))">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} class="flex h-10 items-center justify-center gap-1.5 rounded-lg px-1 text-[13px] font-bold whitespace-nowrap {active === tab.href ? 'bg-task text-task-ink' : 'text-white/75'}">
				{tab.label}
				{#if tab.count}<span class="grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] leading-none {active === tab.href ? 'bg-task-ink text-task' : 'bg-white/20 text-white'}">{tab.count}</span>{/if}
			</a>
		{/each}
	</div>
</div>
