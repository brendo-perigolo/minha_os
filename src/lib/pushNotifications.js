function urlBase64ToUint8Array(base64String) {
  // base64url -> base64
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function getVapidPublicKey() {
  const fromEnv = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim()
  if (fromEnv) return fromEnv

  // Fallback for static hosting (e.g. Vercel) when env vars weren't embedded at build time.
  // This is safe because VAPID public key is not a secret.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/vapid-public-key.txt', { cache: 'no-store' })
      if (res.ok) {
        const text = String(await res.text()).trim()
        if (text) return text
      }
    } catch {
      // ignore and fall through to the error below
    }
  }

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[push] Missing VITE_VAPID_PUBLIC_KEY at runtime', {
      origin: window.location?.origin,
      mode: import.meta.env.MODE,
      prod: import.meta.env.PROD,
    })
  }

  throw new Error(
    `Falta configurar VITE_VAPID_PUBLIC_KEY (mode: ${import.meta.env.MODE}). ` +
      `Configure no Vercel (Project Settings → Environment Variables) ` +
      `ou publique a chave em /vapid-public-key.txt.`
  )
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js')
}

export async function enablePushNotifications({ supabase, userId }) {
  if (!isPushSupported()) {
    throw new Error('Push não suportado neste dispositivo/navegador')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada')
  }


  const vapidPublicKey = await getVapidPublicKey()

  const registration = await getSwRegistration()
  if (!registration) throw new Error('Service Worker não disponível')

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const json = subscription.toJSON()
  const endpoint = subscription.endpoint
  const p256dh = json?.keys?.p256dh
  const auth = json?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Subscription inválida')
  }

  const row = {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })

  if (error) throw error

  localStorage.setItem('push_enabled', '1')
  return { subscription }
}

export async function disablePushNotifications({ supabase, userId }) {
  if (!isPushSupported()) {
    localStorage.removeItem('push_enabled')
    return { unsubscribed: false }
  }

  const registration = await getSwRegistration()
  if (!registration) {
    localStorage.removeItem('push_enabled')
    return { unsubscribed: false }
  }

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    localStorage.removeItem('push_enabled')
    return { unsubscribed: false }
  }

  const endpoint = subscription.endpoint

  // Tenta desinscrever do browser primeiro
  const unsubscribed = await subscription.unsubscribe()

  // Remove do banco (melhor esforço)
  if (endpoint) {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) throw error
  }

  localStorage.removeItem('push_enabled')
  return { unsubscribed }
}

export async function getPushStatus() {
  const supported = isPushSupported()
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'

  if (!supported) {
    return { supported, permission, subscribed: false }
  }

  const reg = await getSwRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return { supported, permission, subscribed: Boolean(sub) }
}
