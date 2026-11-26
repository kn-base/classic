// アプリ本体をキャッシュして、電波がなくても開けるようにする
const CACHE="classic-v15";
const FILES=["./","index.html","style.css","app.js","spotify.js","vendor/jsmediatags.min.js","manifest.webmanifest","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// 毎回サーバーに新しい版があるか確かめ（更新がすぐ届く）、電波がなければキャッシュを使う
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  // 住所に「?」以降が付いたもの（Spotify のログインから戻ったときの一時的な番号など）は保存しない
  const hasQuery=new URL(e.request.url).search!=="";
  e.respondWith(fetch(e.request,{cache:"no-cache"}).then(r=>{if(!hasQuery&&r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
