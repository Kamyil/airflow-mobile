<script lang="ts" module>
	import type { Tone } from './Badge.svelte';

	const MAP: Record<string, [string, Tone]> = {
		// PZ
		NEW: ['Nowa', 'info'],
		IN_PROGRESS: ['W przyjmowaniu', 'task'],
		AWAITING_APPROVAL: ['Czeka na akceptację', 'warn'],
		DONE: ['Zrealizowana', 'ok'],
		// auto
		AWIZOWANE: ['Awizowane', 'neutral'],
		NA_PLACU: ['Na placu', 'warn'],
		POD_DOKIEM: ['Pod DOKiem', 'ok'],
		// MM / ZM / INW
		DRAFT: ['Szkic', 'neutral'],
		TODO: ['Do realizacji', 'info'],
		// źródła MM
		ERP: ['ERP', 'dark'],
		MWS: ['MWS', 'info'],
		APP: ['Apka', 'task']
	};
</script>

<script lang="ts">
	import Badge from './Badge.svelte';

	let { status, label, class: classes = '' }: { status: string; label?: string; class?: string } = $props();
	let entry = $derived(MAP[status] ?? [status, 'neutral' as Tone]);
</script>

<Badge tone={entry[1]} class={classes}>{label ?? entry[0]}</Badge>
