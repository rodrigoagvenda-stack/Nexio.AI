// Zaapply Service Worker — Push + basic caching
const CACHE_NAME = 'zaapply-v1';
const OFFLINE_URL = '/atendimento';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Zaapply', body: event.data.text() };
  }

  const { title = 'Zaapply', body = '', url = '/atendimento', icon = '/favicon.svg', badge = '/favicon.svg', tag = 'zaapply-notification' } = data;

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/atendimento';

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
