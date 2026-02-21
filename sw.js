/**
 * TheValvePro Service Worker
 * Cache-First strategy for static assets and CDN dependencies.
 * The IAPWS thermodynamic library and React core are cached for full offline computation.
 */

const CACHE_NAME = 'thevalvepro-v1';

// Core pages and local assets
const CORE_ASSETS = [
    '/',
    '/expert-apps.html',
    '/new modern leakage.html',
    '/valve-app.html',
    '/index.html',
    '/manifest.json',
    '/assets/images/expert-hero.png',
];

// CDN scripts (React + Babel + IAPWS thermodynamics)
const CDN_ASSETS = [
    'https://unpkg.com/react@18/umd/react.development.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.jsdelivr.net/npm/neutriumjs.thermo.iapws97@1.2.2/dist/neutriumJS.thermo.IAPWS97.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
];

// Install: Pre-cache all core and CDN assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled([
                cache.addAll(CORE_ASSETS),
                cache.addAll(CDN_ASSETS),
            ]);
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

// Fetch: Cache-First, falling back to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and browser-extension requests
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                // Only cache successful, non-opaque responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(() => {
                // Return a simple offline fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/expert-apps.html');
                }
            });
        })
    );
});
