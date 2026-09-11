const CACHE='nty-starnet-v3';
const STATIC_FILES=['/manifest.json','/icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC_FILES)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin){return;}

  const isAppShell=url.pathname==='/'||url.pathname.endsWith('.html')||url.pathname.endsWith('.js');

  if(isAppShell){
    // Reseau en priorite (toujours la derniere version) + cache en secours si hors-ligne
    e.respondWith(
      fetch(e.request).then(res=>{
        const clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html')))
    );
  }else{
    // Fichiers statiques (icones, manifest) : cache en priorite = ultra rapide
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
        const clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }))
    );
  }
});
