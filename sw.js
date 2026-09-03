/**
 * EduCheck - PWA Service Worker (Network First with Offline Fallback)
 * 항상 최신 코드를 우선 로드하고, 오프라인 시에만 캐시 사용
 */

const CACHE_NAME = 'educheck-cache-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. 설치 시 캐시 저장 및 즉시 활성화
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Cache install non-critical:', err);
      });
    })
  );
});

// 2. 활성화 시 모든 구버전 캐시 즉시 완전 삭제
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Network First 전략: 항상 네트워크에서 최신 버전을 먼저 가져오고 실패 시 캐시 사용
self.addEventListener('fetch', (e) => {
  // GET 요청만 처리
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 네트워크 실패 시(오프라인) 캐시에서 반환
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
