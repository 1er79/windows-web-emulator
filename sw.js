/* A versão 0.2 usa o coi-serviceworker oficial do Boxedwine64 para COOP/COEP.
   Este arquivo existe somente para facilitar a retirada do cache antigo 0.1. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wine-web-shell-')).map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
