<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		tall?: boolean;
		class?: string;
		children: Snippet;
		footer?: Snippet;
	}
	let { open = $bindable(), title, description, tall = false, class: classes = '', children, footer }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="overlay fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px]" />
		<Dialog.Content
			class={twMerge(
				'sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-2xl outline-none',
				tall && 'h-[92dvh]',
				classes
			)}
		>
			<div class="flex items-start gap-3 px-5 pt-3 pb-3">
				<div class="flex-1 pt-3">
					<Dialog.Title class="text-lg leading-tight font-extrabold">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="mt-1 text-sm text-muted">{description}</Dialog.Description>
					{/if}
				</div>
				<Dialog.Close class="mt-1 -mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Zamknij">
					<X class="size-5" />
				</Dialog.Close>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="pb-safe border-t border-line px-5 pt-3">
					<div class="flex flex-col gap-2 pb-3">{@render footer()}</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
