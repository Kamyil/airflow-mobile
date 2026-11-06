<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import CameraOff from '@lucide/svelte/icons/camera-off';
	import Flashlight from '@lucide/svelte/icons/flashlight';

	/**
	 * Skaner kodów kamerą (quagga2, jak w dok-app). Kod musi zostać odczytany 2× z rzędu,
	 * żeby odfiltrować błędne odczyty. Na urządzeniach z wbudowanym skanerem używa się pola tekstowego.
	 */
	interface Props {
		open: boolean;
		title?: string;
		onDetect: (code: string) => void;
	}
	let { open = $bindable(), title = 'Skanuj kamerą', onDetect }: Props = $props();

	let error = $state<string | null>(null);
	let starting = $state(true);
	let torch = $state(false);
	let candidate = $state<string | null>(null);

	function camera(node: HTMLDivElement) {
		let stopped = false;
		let Q: typeof import('@ericblade/quagga2').default | null = null;
		let last: string | null = null;
		let hits = 0;
		error = null;
		starting = true;

		const handler = (result: { codeResult?: { code?: string | null } }) => {
			let code = result.codeResult?.code;
			if (!code) return;
			if (code === last) hits++;
			else {
				last = code;
				hits = 1;
			}
			candidate = code;
			if (hits >= 2 && !stopped) {
				stopped = true;
				Q?.stop();
				open = false;
				onDetect(code);
			}
		};

		import('@ericblade/quagga2').then(({ default: Quagga }) => {
			if (stopped) return;
			Q = Quagga;
			Quagga.init(
				{
					inputStream: { type: 'LiveStream', target: node, constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
					locator: { patchSize: 'medium', halfSample: true },
					decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader'] },
					locate: true
				},
				(err: unknown) => {
					starting = false;
					if (err) {
						error = 'Brak dostępu do kamery. Zezwól na użycie kamery w przeglądarce albo wpisz kod ręcznie.';
						return;
					}
					if (stopped) return Quagga.stop();
					Quagga.start();
					Quagga.onDetected(handler);
				}
			);
		});

		return () => {
			stopped = true;
			Q?.offDetected(handler);
			Q?.stop();
		};
	}

	async function toggleTorch() {
		try {
			let track = (document.querySelector('.camera-box video') as HTMLVideoElement | null)?.srcObject as MediaStream | null;
			let t = track?.getVideoTracks()[0];
			torch = !torch;
			await t?.applyConstraints({ advanced: [{ torch } as MediaTrackConstraintSet] });
		} catch {
			torch = false;
		}
	}
</script>

<Sheet bind:open {title} description="Nakieruj kamerę na kod kreskowy.">
	{#if error}
		<div class="grid place-items-center gap-3 rounded-2xl bg-bg p-8 text-center text-sm text-muted">
			<CameraOff class="size-10" />
			{error}
		</div>
	{:else}
		<div class="camera-box relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink" {@attach camera}>
			{#if starting}<p class="absolute inset-0 grid place-items-center text-sm text-white/70">Uruchamiam kamerę…</p>{/if}
			<div class="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-task/90 shadow-[0_0_12px_var(--color-task)]"></div>
		</div>
		<p class="mt-2 h-5 text-center font-mono text-sm text-muted">{candidate ?? ''}</p>
	{/if}
	{#snippet footer()}
		{#if !error}<Button onclick={toggleTorch}><Flashlight class="size-4" />{torch ? 'Wyłącz latarkę' : 'Latarka'}</Button>{/if}
		<Button variant="ghost" onclick={() => (open = false)}>Zamknij</Button>
	{/snippet}
</Sheet>

<style>
	.camera-box :global(video),
	.camera-box :global(canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.camera-box :global(canvas.drawingBuffer) {
		display: none;
	}
</style>
