<script lang="ts" module>
	import type { Tone } from './Badge.svelte';

	export const STATUS: Record<string, [string, Tone]> = {
		// PZ
		NEW: ['Nowa', 'info'],
		IN_PROGRESS: ['Wystawione', 'task'],
		AWAITING_APPROVAL: ['Czeka na akceptację', 'warn'],
		DONE: ['Zrealizowana', 'ok'],
		PZ_TODO: ['Do realizacji', 'info'],
		PZ_DONE: ['Zrealizowana', 'ok'],
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
	let entry = $derived(STATUS[status] ?? [status, 'neutral' as Tone]);
</script>

<Badge tone={entry[1]} class={classes}>{label ?? entry[0]}</Badge>
