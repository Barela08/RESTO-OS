// ====================================================================
// RESTO OS - Firebase Cloud Messaging Background Service Worker
// Handles background web push notifications for floor staff & kitchen
// ====================================================================

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Parse query params or fallback config
const urlParams = new URL(location).searchParams;
const projectId = urlParams.get('projectId') || 'resto-os-3bf6c';
const messagingSenderId = urlParams.get('messagingSenderId') || '349513191718';
const appId = urlParams.get('appId') || '1:349513191718:web:aea175d7b371305a70f1e7';
const apiKey = urlParams.get('apiKey') || 'AIzaSyCXPAvSEUFL9KQ1mRXsodFLoNptIyrmUNU';

if (firebase && !firebase.apps.length) {
  firebase.initializeApp({
    apiKey: apiKey,
    projectId: projectId,
    messagingSenderId: messagingSenderId,
    appId: appId,
  });
}

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const title = payload.notification?.title || payload.data?.title || 'RESTO OS Notification';
    const body = payload.notification?.body || payload.data?.message || 'New restaurant alert';
    const clickAction = payload.data?.clickAction || payload.fcmOptions?.link || '/';

    const notificationOptions = {
      body: body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: payload.data?.tag || 'resto-alert',
      renotify: true,
      data: {
        url: clickAction,
        eventType: payload.data?.eventType,
        tableNumber: payload.data?.tableNumber,
      },
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Error initializing messaging:', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
