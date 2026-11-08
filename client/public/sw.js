const CACHE='oficinapro-v10-2';
const CORE=['/','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/'))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==='basic'){
   const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
  }
  return response;
 }).catch(async()=>{
  const cached=await caches.match(request);
  if(cached)return cached;
  if(request.mode==='navigate')return caches.match('/');
  return Response.error();
 }));
});
self.addEventListener('push',event=>{let data={title:'OficinaPro',body:'Você tem uma atualização.',url:'/app'};try{if(event.data)data={...data,...event.data.json()}}catch{if(event.data)data.body=event.data.text()}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon-192.png',badge:'/icon.svg',data:{url:data.url||'/app'},vibrate:[100,50,100]}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const target=event.notification.data?.url||'/app';for(const client of windows){if('focus'in client){client.navigate(target);return client.focus()}}return self.clients.openWindow(target)}))});
