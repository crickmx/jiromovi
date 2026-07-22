self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Nueva notificacion", body: event.data.text() };
  }

  const isMissedCall = data.tag === "missed-call" && data.caller_number;
  const callerDigits = isMissedCall ? String(data.caller_number).replace(/\D/g, "").slice(-10) : null;

  const options = {
    body: data.body || "",
    icon: "/movirecurso_7.png",
    badge: "/movirecurso_7.png",
    tag: data.tag || "movi-notification",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || "/admin/telefonia",
      timestamp: data.timestamp || Date.now(),
      callerNumber: callerDigits,
    },
    actions: isMissedCall
      ? [
          { action: "call", title: "Llamar" },
          { action: "whatsapp", title: "WhatsApp" },
        ]
      : [
          { action: "open", title: "Ver" },
          { action: "dismiss", title: "Descartar" },
        ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const callerNumber = event.notification.data?.callerNumber;
  let url = event.notification.data?.url || "/admin/telefonia";

  if (event.action === "call" && callerNumber) {
    url = `tel:${callerNumber}`;
  } else if (event.action === "whatsapp" && callerNumber) {
    url = `/centro-contacto/whatsapp?telefono=${callerNumber}`;
  }

  if (event.action === "call") {
    event.waitUntil(self.clients.openWindow(url));
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("notificationclose", () => {});
