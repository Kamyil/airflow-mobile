<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import X from '@lucide/svelte/icons/x';
	import { compressPhoto } from '$lib/photo';

	/** Zdjęcia załadunku (aparat telefonu). `photos` – data URL-e. */
	let { photos = $bindable() }: { photos: string[] } = $props();
	let busy = $state(false);

	async function add(e: Event & { currentTarget: HTMLInputElement }) {
		let files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		busy = true;
		try {
			for (let f of files) photos = [...photos, await compressPhoto(f)];
		} finally {
			busy = false;
		}
	}
</script>

<div class="grid grid-cols-3 gap-2">
	{#each photos as src, i (src)}
		<div class="relative aspect-square overflow-hidden rounded-xl bg-bg">
			<img {src} alt="Zdjęcie {i + 1}" class="size-full object-cover" />
			<button type="button" class="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-ink/70 text-white" aria-label="Usuń zdjęcie" onclick={() => (photos = photos.filter((_, j) => j !== i))}><X class="size-4" /></button>
		</div>
	{/each}
	<label class="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line-strong bg-surface text-center text-xs font-bold text-muted active:bg-bg">
		<span class="grid place-items-center gap-1"><Camera class="size-6" />{busy ? 'Przetwarzam…' : 'Zrób zdjęcie'}</span>
		<input type="file" accept="image/*" capture="environment" multiple class="hidden" onchange={add} />
	</label>
</div>
