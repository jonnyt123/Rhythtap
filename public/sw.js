const SHELL_CACHE='rhythtap-shell-v2';
const RUNTIME_CACHE='rhythtap-runtime-v2';
const BASE=new URL('./',self.location.href).pathname;
const ownsCache=key=>key.startsWith('rhythtap-shell-')||key.startsWith('rhythtap-runtime-');

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.add(BASE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>ownsCache(key)&&key!==SHELL_CACHE&&key!==RUNTIME_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin||url.pathname.endsWith('/sw.js')||url.pathname.includes('/audio/')||url.pathname.includes('/previews/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();void caches.open(SHELL_CACHE).then(cache=>cache.put(BASE,copy))}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(BASE);
   return cached||new Response('RhythmTap is offline and has not been cached on this device yet.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(RUNTIME_CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
