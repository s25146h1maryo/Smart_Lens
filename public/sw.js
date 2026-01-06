// Service Worker for SmartLens PWA
// Handles offline detection and restricts access when offline

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase (Background)
firebase.initializeApp({
    apiKey: 'AIzaSyCHbKe6H0tSJwd3TbEehD834joBLh4nAwk',
    authDomain: 'smartlens-facd7.firebaseapp.com',
    projectId: 'smartlens-facd7',
    storageBucket: 'smartlens-facd7.firebasestorage.app',
    messagingSenderId: '984135844396',
    appId: '1:984135844396:web:53f307b17f3ae6bd700789'
});

const messaging = firebase.messaging();

// Background message handling is managed automatically by the Firebase SDK imports.
// We relying on the default behavior to avoid duplicate notifications.
// Custom logic can be added here if we need to modify the data-only payloads.

const CACHE_NAME = 'smartlens-v1';
const DASHBOARD_URL = '/dashboard';
const OFFLINE_URL = '/offline';

// URLs that are allowed offline (only dashboard)
const ALLOWED_OFFLINE_URLS = [
    '/dashboard',
    '/offline',
    '/_next/static',
    '/icons',
    '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/offline',
                '/icons/icon-192.png',
                '/manifest.json'
            ]).catch(err => console.log('Cache add failed:', err));
        })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - handle offline access restriction
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip based on origin or if it's a firebase request (googleapis)
    if (url.origin.includes('googleapis') || url.origin.includes('firebase')) {
        return;
    }
    
    // Skip non-navigation requests and external URLs
    if (event.request.mode !== 'navigate' || url.origin !== location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Online - return response normally
                return response;
            })
            .catch(() => {
                // Offline - check if URL is allowed
                const isAllowed = ALLOWED_OFFLINE_URLS.some(allowed => 
                    url.pathname.startsWith(allowed)
                );

                if (isAllowed) {
                    // Try to serve from cache
                    return caches.match(event.request).then(cached => {
                        return cached || caches.match(OFFLINE_URL);
                    });
                } else {
                    // Block access - redirect to offline page
                    return caches.match(OFFLINE_URL).then(response => {
                        if (response) {
                            return response;
                        }
                        // Fallback: return a simple offline response
                        return new Response(
                            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>オフライン</title></head><body style="background:#050510;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><h1>オフラインです</h1><p>インターネット接続を確認してください</p></div></body></html>',
                            {
                                headers: { 'Content-Type': 'text/html' }
                            }
                        );
                    });
                }
            })
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
