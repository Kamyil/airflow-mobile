import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ runtime: 'nodejs24.x' }),
		// sprawdzaj co minutę, czy jest nowsza wersja (patrz beforeNavigate w +layout.svelte)
		version: { pollInterval: 60_000 }
	}
};
