/**
 * TheValvePro Service Worker
 * Cache-First strategy for static assets and CDN dependencies.
 * The IAPWS thermodynamic library and React core are cached for full offline computation.
 */

const CACHE_NAME = 'thevalvepro-v2';

// CDN scripts to pre-cache (React + Babel + IAPWS thermodynamics)
const CDN_ASSETS = [
    'https://unpkg.com/react@18/umd/react.development.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.jsdelivr.net/npm/neutriumjs.thermo.iapws97@1.2.2/dist/neutriumJS.thermo.IAPWS97.min.js',
];

// Install: Pre-cache CDN assets only
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Network-First for navigation/HTML, Cache-First for CDN assets only
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);
    const isCdnAsset = CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn.split('/dist/')[0]) || event.request.url === cdn);

    // For CDN assets: cache-first
    if (isCdnAsset) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // For all other requests (HTML pages, local assets): Network-First, no interference
    // Only handle if explicitly offline (fetch fails)
    event.respondWith(
        fetch(event.request).catch(() => {
            // Offline fallback: try to serve from cache
            return caches.match(event.request).then((cached) => {
                if (cached) return cached;
                // For navigation requests, try the main page
                if (event.request.mode === 'navigate') {
                    return caches.match('/expert-apps.html');
                }
            });
        })
    );
});
