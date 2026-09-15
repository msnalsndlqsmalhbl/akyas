/* ═══════════════════════════════════════════════════════════════
   Service Worker - قسم الأكياس (محسّن)
   ═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'akyas-v1.0.0';           // ← اسم مختلف
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const FONTS_CACHE = `${CACHE_VERSION}-fonts`;

// الملفات الأساسية
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './supabase.js',
  './modules.js',
  './returns.js',
  './advanced.js',
  './reports.js',
  './manifest.json',
  './offline.html'
];

/* ─────────── التثبيت ─────────── */
self.addEventListener('install', (event) => {
  console.log('📦 SW [Akyas]: تثبيت...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 SW [Akyas]: تخزين الملفات...');
        return Promise.all(
          PRECACHE_URLS.map(url => 
            cache.add(new Request(url, { cache: 'reload' }))
              .catch(err => console.warn(`⚠️ فشل تخزين ${url}:`, err))
          )
        );
      })
      .then(() => {
        console.log('✅ SW [Akyas]: التثبيت نجح');
        return self.skipWaiting();
      })
  );
});

/* ─────────── التفعيل ─────────── */
self.addEventListener('activate', (event) => {
  console.log('🚀 SW [Akyas]: تفعيل...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => 
              // ✅ فقط caches الخاصة بـ akyas
              name.startsWith('akyas-') && 
              name !== STATIC_CACHE && 
              name !== RUNTIME_CACHE && 
              name !== FONTS_CACHE
            )
            .map(name => {
              console.log('🗑️ SW [Akyas]: حذف cache قديم:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('✅ SW [Akyas]: التفعيل نجح');
        return self.clients.claim();
      })
  );
});

/* ─────────── Fetch ─────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ❌ تجاهل Supabase
  if (url.hostname.includes('supabase.co')) return;

  // ❌ تجاهل POST/PUT/DELETE
  if (request.method !== 'GET') return;

  // ✅ خطوط Google
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // ✅ JS SDK من CDN
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // ✅ الملفات المحلية
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('./offline.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* ─────────── رسائل ─────────── */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.filter(n => n.startsWith('akyas-')).forEach(name => caches.delete(name));
    });
  }
  if (event.data === 'PRELOAD_ALL') {
    caches.open(STATIC_CACHE).then(cache => {
      PRECACHE_URLS.forEach(url => {
        cache.add(url).catch(() => {});
      });
    });
  }
});
