// network-first for code, cache-first for card art; bump BUILD to refresh
const V='mtgc-202611021243';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await clients.claim();})()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
const art=u.pathname.includes('/assets/');
e.respondWith((async()=>{const c=await caches.open(V);
if(art){const m=await c.match(r);if(m)return m;}
try{const f=await fetch(r,{cache:'no-cache'});if(f.ok)c.put(r,f.clone());return f;}catch(err){const m=await c.match(r);if(m)return m;throw err;}})());});
