// MOVI Digital — Service Worker
// Handles Web Push notifications for llamadas perdidas

const APP_URL = self.location.origin;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'MOVI', body: event.data?.text() || 'Nueva notificación' };
  }

  const title = data.title || '📞 Llamada perdida';
  const options = {
    body: data.body || 'Tienes una llamada perdida',
    icon: data.icon || '/movirecurso_7.png',
    badge: '/movirecurso_7.png',
    tag: data.tag || `llamada-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/admin/telefonia',
      llamadaId: data.llamadaId,
      caller: data.caller,
    },
    actions: [
      { action: 'ver', title: 'Ver llamada' },
      { action: 'cerrar', title: 'Cerrar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'cerrar') return;

  const targetUrl = event.notification.data?.url || '/admin/telefonia';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(APP_URL) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
