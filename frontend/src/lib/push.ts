import { api } from './api';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushNotificationSupported(): Promise<boolean> {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!(await isPushNotificationSupported())) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!(await isPushNotificationSupported())) {
    throw new Error('Push notifications are not supported on this browser or device.');
  }

  // Request Notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // Fetch VAPID public key from backend
  const { public_key: vapidPublicKey } = await api.get<{ public_key: string }>('/push/vapid-public-key');
  if (!vapidPublicKey) {
    throw new Error('VAPID public key not configured on server.');
  }

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
  const registration = await navigator.serviceWorker.ready;

  // Subscribe via pushManager
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey as unknown as BufferSource,
  });

  const jsonSub = subscription.toJSON();
  if (!jsonSub.endpoint || !jsonSub.keys?.p256dh || !jsonSub.keys?.auth) {
    throw new Error('Failed to obtain complete subscription keys from browser.');
  }

  // Register subscription on backend
  await api.post('/push/subscribe', {
    endpoint: jsonSub.endpoint,
    keys: {
      p256dh: jsonSub.keys.p256dh,
      auth: jsonSub.keys.auth,
    },
    user_agent: navigator.userAgent,
  });

  return subscription;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!(await isPushNotificationSupported())) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    try {
      await api.delete('/push/subscribe', { endpoint });
    } catch {
      // Ignore network failure when pruning server-side
    }
    return true;
  }
  return false;
}

export async function sendTestPush(): Promise<{ sent: number; failed: number }> {
  return api.post<{ sent: number; failed: number }>('/push/test');
}
