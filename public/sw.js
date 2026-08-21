const SHELL_CACHE='rhythtap-shell-v1';
const RUNTIME_CACHE='rhythtap-runtime-v1';
const BASE='/Rhythtap/';

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.add(BASE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rhythtap-shell-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin||url.pathname.includes('/audio/')||url.pathname.includes('/previews/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();void caches.open(SHELL_CACHE).then(cache=>cache.put(BASE,copy));return response}).catch(()=>caches.match(BASE)));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(RUNTIME_CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
