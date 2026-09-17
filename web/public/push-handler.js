// Обработчик Web Push (P2.4) — подгружается в сгенерированный service
// worker через workbox.importScripts (generateSW не встраивает свой код).
// Payload приходит JSON-строкой из NotificationsService.deliver.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'SiberianGym', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SiberianGym', {
      body: data.body || '',
      tag: data.tag || 'siberiangym',
      icon: 'pwa-192.png',
      badge: 'pwa-192.png',
      data: { url: './#/client/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('./#/client/notifications')
    }),
  )
})
