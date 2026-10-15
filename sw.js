/* SKYHEM Takip telefon sürümü: kurulabilmesi ve internetsiz açılabilmesi için basit hizmet çalışanı.
 * Yalnız bu sitenin dosyaları: önce ağ, ağ yoksa son kopya. Supabase istekleri (kayıtlar, güncellemeler) hiç ellenmez. */
const ONBELLEK = 'skyhem-kabuk';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET' || new URL(istek.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(istek)
      .then((yanit) => {
        if (yanit.ok) { const kopya = yanit.clone(); caches.open(ONBELLEK).then((c) => c.put(istek, kopya)); }
        return yanit;
      })
      .catch(() => caches.match(istek, { ignoreSearch: true }).then((y) => y || Response.error()))
  );
});
