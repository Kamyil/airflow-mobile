<script lang="ts">
	import { toasts } from '$lib/toast.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	const icons = { ok: CircleCheck, bad: CircleAlert, info: Info, warn: TriangleAlert };
	const tones = { ok: 'text-ok', bad: 'text-bad', info: 'text-info', warn: 'text-warn' };
</script>

<div class="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-md flex-col gap-2 px-3 pt-3" aria-live="polite">
	{#each toasts.items as t (t.id)}
		{@const Icon = icons[t.tone]}
		<button
			type="button"
			class="toast-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-xl"
			onclick={() => toasts.dismiss(t.id)}
		>
			<Icon class="mt-0.5 size-5 shrink-0 {tones[t.tone]} brightness-150" />
			<div class="min-w-0">
				<p class="font-bold">{t.title}</p>
				{#if t.description}<p class="mt-0.5 text-sm text-white/75">{t.description}</p>{/if}
				{#if t.details?.length}
					<ul class="mt-1 list-disc pl-4 text-sm text-white/75">
						{#each t.details as d}<li>{d}</li>{/each}
					</ul>
				{/if}
			</div>
		</button>
	{/each}
</div>
