'use strict';
const CACHE='robot-exam-official-202609-v1';
const ASSETS=['./','./index.html','./app.js','./enhancements.css','./questions.json','./explanations.json','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  './assets/questions/image1.png','./assets/questions/image2.png','./assets/questions/image3.png','./assets/questions/image4.png','./assets/questions/image5.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const scope=self.registration.scope;
  for(const key of await caches.keys()){
    if(key===CACHE||!/^(jj-robot-v[1-4]-|robot-exam-official-)/.test(key))continue;
    const cache=await caches.open(key),requests=await cache.keys();
    const ours=requests.filter(request=>request.url.startsWith(scope));
    if(ours.length&&ours.length===requests.length)await caches.delete(key);
    else for(const request of ours)await cache.delete(request);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(event.request);
    if(cached)return cached;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate')return await cache.match('./index.html');
      throw error;
    }
  })());
});
