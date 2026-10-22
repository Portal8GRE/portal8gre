const CACHE='agenda8gre-v093';
const SHELL=['/agenda8gre','/agenda8gre-manifest.json','/agenda8gre-icon-192.png','/agenda8gre-icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const u=new URL(event.request.url);
  if(u.origin!==self.location.origin) return;
  if(event.request.mode==='navigate' && u.pathname.startsWith('/agenda8gre')){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/agenda8gre')));
    return;
  }
  if(SHELL.includes(u.pathname)){
    event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request)));
  }
});
