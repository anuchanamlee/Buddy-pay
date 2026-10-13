// ใช้ BuddyPay แบบแอปบนมือถือ (PWA): ติดตั้งลงหน้าจอโฮม ตัวเลขบนไอคอน และการแจ้งเตือน
// ทุกฟังก์ชันปลอดภัยที่จะเรียกในเบราว์เซอร์ที่ไม่รองรับ (จะไม่ทำอะไร)

/** เปิดจากไอคอนบนหน้าจอโฮมอยู่หรือไม่ (ติดตั้งแล้ว) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS รายงานตัวเองเป็น Mac แต่มีจอสัมผัส
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
}

/** ตัวเลขบนไอคอนแอป (iPhone ต้องติดตั้งลงหน้าจอโฮมและอนุญาตการแจ้งเตือนก่อน) */
export function updateAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  const task = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge();
  task.catch(() => undefined);
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** คีย์สาธารณะของ Web Push (VAPID) ไม่ใช่ความลับ ไม่ได้ตั้งไว้ = ปิดฟีเจอร์แจ้งเตือน */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** ขออนุญาตแจ้งเตือนแล้วสมัครรับ push คืน subscription (JSON) หรือ null ถ้าผู้ใช้ไม่อนุญาต */
export async function subscribePush(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) }));
  return sub.toJSON();
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) || null;
}

/** id เอกสารของ subscription ใน Firestore: hash ของ endpoint (endpoint ยาวเกินจะใช้เป็น id ตรง ๆ) */
export async function subscriptionId(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
