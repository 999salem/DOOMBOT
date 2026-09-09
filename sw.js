const CACHE='doombot-v13-1-stable';
const CORE=[
  './','./index.html','./intel.html','./leaks.html','./theories.html',
  './analyst.html','./about.html','./settings.html','./offline.html',
  './manifest.webmanifest'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      for(const url of CORE){try{await cache.add(url)}catch(e){}}
    }).then(()=>self.skipWaiting())
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
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
          return res;
        })
        .catch(async()=>{
          return (await caches.match(event.request))
              || (await caches.match('./index.html'))
              || (await caches.match('./offline.html'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const fresh=fetch(event.request).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
        return res;
      }).catch(()=>cached);
      return cached||fresh;
    })
  );
});
