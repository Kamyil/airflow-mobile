/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

/**
 * Service worker PWA: zasoby aplikacji w cache, nawigacja network-first z powrotem do cache.
 * Dzięki temu apka startuje i działa bez zasięgu (dane makiety są i tak lokalne).
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `airflow-mobile-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	let req = event.request;
	if (req.method !== 'GET') return;
	let url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((r) => r ?? fetch(req)));
		return;
	}

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					let copy = res.clone();
					if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
					return res;
				})
				.catch(async () => (await caches.match(req)) ?? (await caches.match('/')) ?? Response.error())
		);
	}
});
