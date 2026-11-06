<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { twMerge } from 'tailwind-merge';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	type Variant = 'primary' | 'task' | 'secondary' | 'ghost' | 'danger' | 'ok' | 'outline';
	type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		href?: string;
		loading?: boolean;
		class?: string;
		children?: Snippet;
	}

	let { variant = 'secondary', size = 'md', href, loading = false, class: classes = '', disabled, children, ...rest }: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-semibold select-none transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

	const variants: Record<Variant, string> = {
		primary: 'bg-ink text-white hover:bg-ink-2',
		task: 'bg-task text-task-ink hover:brightness-95',
		secondary: 'bg-surface text-ink border border-line-strong hover:bg-bg',
		outline: 'border border-current bg-transparent',
		ghost: 'bg-transparent text-ink hover:bg-ink/5',
		danger: 'bg-bad-soft text-bad hover:bg-bad/15',
		ok: 'bg-ok text-white hover:brightness-110'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-9 rounded-lg px-3 text-sm',
		md: 'h-11 rounded-xl px-4 text-[15px]',
		lg: 'h-13 rounded-xl px-5 text-base',
		xl: 'h-16 rounded-2xl px-6 text-lg',
		icon: 'size-11 rounded-xl'
	};

	let cls = $derived(twMerge(base, variants[variant], sizes[size], classes));
</script>

{#if href && !disabled}
	<a {href} class={cls}>{@render children?.()}</a>
{:else}
	<button type="button" class={cls} disabled={disabled || loading} {...rest}>
		{#if loading}<LoaderCircle class="size-5 animate-spin" />{/if}
		{@render children?.()}
	</button>
{/if}
