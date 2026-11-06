<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { connectivity } from '$lib/connectivity.svelte';
	import AppMenu from './AppMenu.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		back?: string;
		actions?: Snippet;
		below?: Snippet;
		/** Menu operatora po prawej (domyślnie tak) */
		menu?: boolean;
	}
	let { title, subtitle, back, actions, below, menu = true }: Props = $props();
</script>

<header class="pt-safe sticky top-0 z-30 bg-ink text-white">
	{#if !connectivity.online || connectivity.syncing}
		<div class="flex items-center justify-center gap-2 px-3 py-1 text-xs font-bold {connectivity.online ? 'bg-info' : 'bg-warn'}">
			{#if connectivity.online}
				<RefreshCw class="size-3.5 animate-spin" />Wysyłam kolejkę… ({connectivity.outbox.length})
			{:else}
				<WifiOff class="size-3.5" />Offline – zapisuję lokalnie{connectivity.outbox.length ? ` · ${connectivity.outbox.length} w kolejce` : ''}
			{/if}
		</div>
	{/if}
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
		{#if menu}<AppMenu />{/if}
	</div>
	{@render below?.()}
</header>
