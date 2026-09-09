'use strict';
const CACHE='jj-robot-v4-20260909-1';
const ASSETS=['./','./index.html','./app.js','./enhancements.css','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>/^jj-robot-v[34]-/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(error=>{
    if(event.request.mode==='navigate')return caches.match('./index.html');throw error;
  })));
});
