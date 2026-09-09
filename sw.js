const CACHE='doombot-v20-1-theory-map';

const CORE=[
  './',
  './index.html',
  './leaks.html',
  './warroom.html',
  './theories.html',
  './map.html',
  './account.html',
  './offline.html',
  './manifest.webmanifest',
  './v18-community.css',
  './v18-common.js',
  './v18-warroom.js',
  './v18-account.js',
  './v18-theory-share.js',
  './warroom-seed.json',
  './icon-192.png',
  './icon-512.png',
  './salem-mark.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache=>{
        for(const url of CORE){
          try{await cache.add(new Request(url,{cache:'reload'}));}catch(e){}
        }
      })
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
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate' || /\.(?:html|css|js|json)$/.test(url.pathname)){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          }
          return response;
        })
        .catch(async()=>{
          return (await caches.match(event.request,{ignoreSearch:true})) ||
            (event.request.mode==='navigate'
              ? (await caches.match('./offline.html')) || (await caches.match('./index.html'))
              : Response.error());
        })
    );
  }
});
