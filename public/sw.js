/* BuddyPay service worker
 * - รับการแจ้งเตือน (Web Push) และอัปเดตตัวเลขบนไอคอนแอป
 * - เปิดหน้าที่แจ้งเตือนชี้ไปเมื่อกด
 * - เก็บไฟล์ของแอปไว้ในเครื่อง ให้หน้าหารบิลเปิดได้ตอนเน็ตไม่ดี
 * เปลี่ยน VERSION เมื่อแก้ไฟล์นี้ เพื่อล้างแคชเก่า
 */
const VERSION = 'v1';
const STATIC_CACHE = `buddypay-static-${VERSION}`;
const PAGE_CACHE = `buddypay-pages-${VERSION}`;
const OFFLINE_PAGES = ['/share-bill'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(OFFLINE_PAGES))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('buddypay-') && !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase และบริการอื่นไม่ยุ่ง
  if (url.pathname.startsWith('/api/')) return;

  // ไฟล์ของ Next.js ที่มี hash ในชื่อ: ใช้จากแคชได้เลย
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // หน้าเว็บ: เอาจาก server ก่อนเสมอ ถ้าไม่มีเน็ตใช้หน้าที่เก็บไว้ (หน้าหารบิลคำนวณในเครื่องได้)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && OFFLINE_PAGES.includes(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match('/share-bill')) || Response.error()),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'BuddyPay';
  const tasks = [
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag || 'buddypay-reminder',
      data: { url: data.url || '/bill-history' },
    }),
  ];
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => undefined));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/bill-history', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
