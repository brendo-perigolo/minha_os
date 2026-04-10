/* Minimal PWA Service Worker + Push Notifications */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = null
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Notificação', body: event.data.text() }
  }

  const title = payload?.title || 'ELETROCED'
  const body = payload?.body || ''
  const url = payload?.url || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload?.tag || 'eletroced',
      data: { url },
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification?.data?.url || '/'
  const targetUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        try {
          if ('focus' in client) {
            client.focus()
          }
          client.navigate(targetUrl)
          return
        } catch {
          // ignore
        }
      }
      await self.clients.openWindow(targetUrl)
    })()
  )
})
