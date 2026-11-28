'use strict';

var CACHE_NAME = 'office-scene-v10';
var SHELL = ['./', './index.html', './style.css', './themes.css', './a11y.css', './theme.js', './app.js', './office3d.js', './7-three.min.js', './4-kufi-regular.woff', './5-kufi-bold.woff', './6-mono.woff', './manifest.json'];

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
        return null; /* feed.json is never stored here: public screen, no free text at rest */
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

var HEAVY = /\/(o3[gpml]?[a-z]*_?[^\/]*\.js|[^\/]*three\.min\.js|[^\/]+\.woff)$/;

/* heavy static files: cache first, refresh in the background (versioned ?v= URLs bust it) */
function cacheFirst(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (hit) {
      var net = fetch(request).then(function (res) {
        if (res && res.ok) { cache.put(request, res.clone()); }
        return res;
      });
      if (hit) { net.catch(function () {}); return hit; }
      return net;
    });
  });
}

function handleAsset(request) {
  if (HEAVY.test(new URL(request.url).pathname)) { return cacheFirst(request); }
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
