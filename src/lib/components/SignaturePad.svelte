<script lang="ts">
	import Eraser from '@lucide/svelte/icons/eraser';

	/** Podpis palcem (kierowca przy wydaniu). Wynik: data URL PNG albo null. */
	let { value = $bindable() }: { value: string | null } = $props();

	let canvas: HTMLCanvasElement;
	let drawing = false;

	function setup(node: HTMLCanvasElement) {
		canvas = node;
		let ratio = window.devicePixelRatio || 1;
		node.width = node.clientWidth * ratio;
		node.height = node.clientHeight * ratio;
		let ctx = node.getContext('2d')!;
		ctx.scale(ratio, ratio);
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#14181c';
	}

	const pos = (e: PointerEvent) => {
		let r = canvas.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top] as const;
	};

	function down(e: PointerEvent) {
		drawing = true;
		canvas.setPointerCapture(e.pointerId);
		let ctx = canvas.getContext('2d')!;
		ctx.beginPath();
		ctx.moveTo(...pos(e));
	}
	function move(e: PointerEvent) {
		if (!drawing) return;
		let ctx = canvas.getContext('2d')!;
		ctx.lineTo(...pos(e));
		ctx.stroke();
	}
	function up() {
		if (!drawing) return;
		drawing = false;
		value = canvas.toDataURL('image/png');
	}
	function clear() {
		canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
		value = null;
	}
</script>

<div class="relative">
	<canvas {@attach setup} class="h-40 w-full touch-none rounded-xl border-2 border-dashed border-line-strong bg-surface" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}></canvas>
	{#if !value}<p class="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Podpis kierowcy</p>{/if}
	<button type="button" class="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-bg text-muted" aria-label="Wyczyść podpis" onclick={clear}><Eraser class="size-4" /></button>
</div>
