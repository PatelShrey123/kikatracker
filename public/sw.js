// Kirka Hub no longer uses push notifications. This replaces an old ad service worker and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch (e) { /* nothing to unsubscribe */ }
      await self.registration.unregister();
    })()
  );
});
