const APP_URL = self.location.origin;

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'JIRO', body: event.data?.text() || 'Nueva notificacion' };
  }
  const title = data.title || '📞 Llamada perdida';
  const options = {
    body: data.body || 'Tienes una llamada perdida',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || `llamada-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/telefonia', llamadaId: data.llamadaId, caller: data.caller },
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
  const targetUrl = event.notification.data?.url || '/telefonia';
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });
