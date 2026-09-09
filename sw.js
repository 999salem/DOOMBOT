const CACHE='doombot-v17-1-media-theory-fix';
const CORE=[
  './','./index.html','./intel.html','./leaks.html','./theories.html',
  './analyst.html','./plot.html','./credits.html','./about.html','./settings.html','./offline.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/salem-mark.svg',
  './data/live-intel.json','./data/leak-images.json'
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
        .catch(async()=>
          (await caches.match(event.request)) ||
          (await caches.match('./index.html')) ||
          (await caches.match('./offline.html'))
        )
    );
    return;
  }

  // Timestamped live-data requests should always try network first.
  if(url.pathname.endsWith('/data/live-intel.json') || url.pathname.endsWith('/data/leak-images.json')){
    event.respondWith(
      fetch(event.request,{cache:'no-store'}).then(res=>{
        const clean=new Request(url.origin+url.pathname);
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(clean,copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match(new Request(url.origin+url.pathname)))
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
