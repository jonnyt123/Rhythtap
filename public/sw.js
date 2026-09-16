const scriptUrl=new URL(self.location.href);
const BUILD=scriptUrl.searchParams.get('v')||'static-v3';
const SHELL_CACHE='rhythtap-shell-'+BUILD;
const RUNTIME_CACHE='rhythtap-runtime-'+BUILD;
const BASE=new URL('./',scriptUrl).pathname;
const ownsCache=key=>key.startsWith('rhythtap-shell-')||key.startsWith('rhythtap-runtime-');
const isAppShellPath=pathname=>pathname===BASE||pathname===BASE+'index.html';

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
  const appShell=isAppShellPath(url.pathname);
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok&&appShell){const copy=response.clone();void caches.open(SHELL_CACHE).then(cache=>cache.put(BASE,copy))}
   return response;
  }).catch(async()=>{
   if(appShell){const cached=await caches.match(BASE);if(cached)return cached}
   return new Response('RhythmTap is offline and this page is not available yet.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(RUNTIME_CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
