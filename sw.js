const CACHE='doombot-v13-1';
const CORE=[
  './','./index.html','./intel.html','./leaks.html','./theories.html','./analyst.html','./about.html','./settings.html','./offline.html',
  './assets/css/styles.css','./assets/js/app.js','./manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './data/live-intel.json','./data/leak-images.json'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(res=>{
        const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;
      }).catch(async()=>{
        return (await caches.match(event.request)) || (await caches.match('./offline.html'));
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;
    }).catch(()=>caches.match(event.request))
  );
});
