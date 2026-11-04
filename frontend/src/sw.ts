/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

// 1. Cleanup outdated caches from prior versions
cleanupOutdatedCaches();

// 2. Precache static assets injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

// 3. SPA Navigation fallback: route navigation requests to index.html, excluding /api/
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// 4. Runtime caching: StaleWhileRevalidate for reference data (Categories & Current User)
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.endsWith('/categories') || url.pathname.endsWith('/users/me')),
  new StaleWhileRevalidate({
    cacheName: 'spendwise-reference-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// 5. Update handling: skip waiting when triggered
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 6. Web Push Notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'SpendWise';
    const options: NotificationOptions = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      data: data.data || { url: '/' },
      tag: data.tag || 'spendwise_notification',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('SpendWise', {
        body: text,
        icon: '/icons/icon-192.png',
        data: { url: '/' },
      })
    );
  }
});

// 7. Notification Click handler — navigate directly to /add or target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
