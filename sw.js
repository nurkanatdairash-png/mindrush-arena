const CACHE = 'mindrush-v1';
const BASE = self.registration.scope;
const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'styles.css',
  BASE + 'app.js',
  BASE + 'game.js',
  BASE + 'icon.svg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request: req } = e;
  const url = new URL(req.url);

  // Never intercept Supabase API or Google Fonts
  if (url.hostname.endsWith('.supabase.co') || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return;

  // Navigation requests → SPA shell fallback
  if (req.mode === 'navigate') {
    e.respondWith(caches.match(BASE + 'index.html').then(r => r || fetch(req)));
    return;
  }

  // All other assets: cache-first, update in background
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise;
    })
  );
});
