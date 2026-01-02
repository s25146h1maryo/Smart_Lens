// Firebase Cloud Messaging Service Worker
// This handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
    apiKey: 'AIzaSyCHbKe6H0tSJwd3TbEehD834joBLh4nAwk',
    authDomain: 'smartlens-facd7.firebaseapp.com',
    projectId: 'smartlens-facd7',
    storageBucket: 'smartlens-facd7.firebasestorage.app',
    messagingSenderId: '984135844396',
    appId: '1:984135844396:web:53f307b17f3ae6bd700789'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const notificationTitle = payload.notification?.title || 'SmartLens';
    const notificationOptions = {
        body: payload.notification?.body || '新しい通知があります',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: payload.data?.tag || 'default',
        data: {
            url: payload.data?.url || '/dashboard'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (const client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
