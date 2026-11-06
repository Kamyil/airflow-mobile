<script lang="ts" module>
	export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'task' | 'dark';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		tone?: Tone;
		class?: string;
		children: Snippet;
	}
	let { tone = 'neutral', class: classes = '', children }: Props = $props();

	const tones: Record<Tone, string> = {
		neutral: 'bg-ink/6 text-ink-2',
		ok: 'bg-ok-soft text-ok',
		warn: 'bg-warn-soft text-warn',
		bad: 'bg-bad-soft text-bad',
		info: 'bg-info-soft text-info',
		task: 'bg-task text-task-ink',
		dark: 'bg-ink text-white'
	};
</script>

<span class={twMerge('inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-bold whitespace-nowrap [&_svg]:size-3.5', tones[tone], classes)}>
	{@render children()}
</span>
