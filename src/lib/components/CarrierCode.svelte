<script lang="ts">
	import { twMerge } from 'tailwind-merge';

	/**
	 * Kod nośnika bywa długi (do 15 znaków), więc przy szybkim spojrzeniu liczy się końcówka:
	 * prefiks przygaszony, ostatnie 5 znaków wytłuszczone.
	 */
	let { code, class: classes = '' }: { code: string; class?: string } = $props();

	let head = $derived(code.slice(0, -5));
	let tail = $derived(code.slice(-5));
</script>

<span class={twMerge('font-mono tracking-tight whitespace-nowrap', classes)}><span class="opacity-50">{head}</span><b class="font-extrabold">{tail}</b></span>
