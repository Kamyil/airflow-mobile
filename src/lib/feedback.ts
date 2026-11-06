/** Sygnał dźwiękowy + wibracja po skanie (zamiast plików audio z dok-app) */
let ctx: AudioContext | null = null;

export function beep(kind: 'ok' | 'bad') {
	try {
		ctx ??= new AudioContext();
		let osc = ctx.createOscillator();
		let gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.value = kind === 'ok' ? 1760 : 220;
		gain.gain.value = 0.05;
		osc.connect(gain).connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + (kind === 'ok' ? 0.08 : 0.25));
	} catch {
		// brak WebAudio
	}
	try {
		navigator.vibrate?.(kind === 'ok' ? 40 : [80, 60, 80]);
	} catch {
		// brak wibracji
	}
}
