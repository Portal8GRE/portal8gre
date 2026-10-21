const CACHE='agenda8gre-v086';
const PAGE='/agenda8gre';
const SHELL=[
  PAGE,
  '/agenda8gre-manifest.json',
  '/agenda8gre-icon-192.png',
  '/agenda8gre-icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  if(event.request.mode==='navigate' && url.pathname.startsWith('/agenda8gre')){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(PAGE,copy));
          }
          return response;
        })
        .catch(()=>caches.match(PAGE))
    );
    return;
  }

  if(SHELL.includes(url.pathname)){
    event.respondWith(
      caches.match(event.request).then(cached=>cached||fetch(event.request))
    );
  }
});
