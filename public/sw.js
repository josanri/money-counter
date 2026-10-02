const CACHE = 'money-counter-v8';
const APP_BASE = new URL('./', self.location.href);
const ASSETS = ['', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg', 'icons/icon-maskable.svg']
	.map((path) => new URL(path, APP_BASE).href);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					return response;
				})
				.catch(() => caches.match(event.request)),
		);
		return;
	}
	event.respondWith(
		caches.match(event.request).then((cached) => cached || fetch(event.request)),
	);
});
