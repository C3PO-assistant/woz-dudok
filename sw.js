const CACHE_NAME = 'woz-dudok-v3.15.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                // Take control immediately
                return self.skipWaiting();
            })
            .catch(err => {
                console.log('Service Worker: Cache failed', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            // Take control of all pages immediately
            return self.clients.claim();
        }).then(() => {
            // Force all open tabs to reload so they get the fresh cache
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.navigate(client.url));
            });
        })
    );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;
    if (event.request.url.includes('tile.openstreetmap.org')) return;

    const isHTML = event.request.destination === 'document' ||
                   event.request.url.endsWith('.html') ||
                   event.request.url.endsWith('/') ||
                   !event.request.url.includes('.');

    if (isHTML) {
        // Network-first voor HTML: altijd verse versie ophalen
        event.respondWith(
            fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => caches.match(event.request))
        );
    } else {
        // Cache-first voor statische assets (JS, CSS, afbeeldingen)
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200) return response;
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
    }
});

// Background sync for future enhancements
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync', event.tag);
    // Could be used for syncing favorites or settings
});

// Push notifications for future enhancements
self.addEventListener('push', event => {
    if (event.data) {
        const options = {
            body: event.data.text(),
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-96x96.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Bekijk kaart',
                    icon: '/images/checkmark.png'
                },
                {
                    action: 'close',
                    title: 'Sluiten',
                    icon: '/images/xmark.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification('WOZ Dudok Update', options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling for communication with main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        caches.open(CACHE_NAME).then(cache => {
            cache.keys().then(keys => {
                event.ports[0].postMessage({
                    type: 'CACHE_SIZE',
                    size: keys.length
                });
            });
        });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({
                type: 'CACHE_CLEARED'
            });
        });
    }
});

// Network status detection
self.addEventListener('online', () => {
    console.log('Service Worker: Back online');
    // Could be used to sync data when back online
});

self.addEventListener('offline', () => {
    console.log('Service Worker: Gone offline');
    // Could be used to show offline indicator
});