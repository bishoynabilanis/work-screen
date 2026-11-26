'use strict';

var CACHE_NAME = 'office-scene-v5';
var SHELL = ['./', './index.html', './style.css', './app.js', './office3d.js', './manifest.json', './feed.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
            return null;
          });
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function feedCacheKey(requestUrl) {
  var url = new URL(requestUrl);
  return url.origin + url.pathname;
}

function withCacheHit(response) {
  var headers = new Headers(response.headers);
  headers.set('X-Feed-Cache', 'hit');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

function handleFeed(request) {
  var key = feedCacheKey(request.url);

  return fetch(request, { cache: 'no-store' })
    .then(function (response) {
      if (!response || !response.ok) {
        throw new Error('feed unavailable');
      }
      var copy = response.clone();
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.put(key, copy);
      }).then(function () {
        return response;
      });
    })
    .catch(function () {
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(key).then(function (cached) {
          if (cached) {
            return withCacheHit(cached);
          }
          return cache.match(request, { ignoreSearch: true }).then(function (fallback) {
            if (fallback) {
              return withCacheHit(fallback);
            }
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
          });
        });
      });
    });
}

function networkFirst(request, fallbackKey) {
  return fetch(request, { cache: 'no-store' }).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request, { ignoreSearch: true }).then(function (cached) {
        if (cached) { return cached; }
        if (fallbackKey) {
          return cache.match(fallbackKey).then(function (shell) {
            return shell || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
          });
        }
        return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    });
  });
}

function handleNavigation(request) {
  return networkFirst(request, './index.html');
}

function handleAsset(request) {
  return networkFirst(request, null);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.endsWith('/feed.json')) {
    event.respondWith(handleFeed(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
