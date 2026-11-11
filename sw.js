/* NON GIRARTI — service worker.
 * - Shell (html/css/js/vendor/icone): precache, cache-first. Nuova versione => nuovo SW "in attesa" => banner nell'app.
 * - Asset pesanti (modelli, texture, audio): cache separata; scaricati in background dopo l'installazione.
 * Le due versioni qui sotto le aggiorna tools/bump.sh a ogni modifica (hash del contenuto): non toccarle a mano. */
const SHELL_VERSION = '7e58568477';   // @shell
const ASSET_VERSION = 'fab5f4f5a9';   // @assets
const SHELL = 'ng-shell-' + SHELL_VERSION, ASSETS = 'ng-assets-' + ASSET_VERSION;
const SHELL_FILES = ['./','./css/style.css','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-32.png','./icons/icon-512.png','./icons/maskable-512.png','./index.html','./js/audio/audio.js','./js/events/cellar.js','./js/events/combat.js','./js/events/dawn.js','./js/events/door.js','./js/events/glass.js','./js/events/hall.js','./js/events/morgue.js','./js/events/scare.js','./js/events/tower.js','./js/events/warehouse.js','./js/main.js','./js/player/controls.js','./js/player/player.js','./js/pwa.js','./js/story.js','./js/ui/instability.js','./js/world/blood.js','./js/world/decor.js','./js/world/dust.js','./js/world/lights.js','./js/world/materials.js','./js/world/props.js','./js/world/redlight.js','./js/world/rooms.js','./js/world/tunnel.js','./manifest.webmanifest','./vendor/three/LICENSE','./vendor/three/Reflector.js','./vendor/three/loaders/GLTFLoader.js','./vendor/three/three.module.min.js','./vendor/three/utils/BufferGeometryUtils.js']; // @shellfiles
const ASSET_FILES = ['./assets/audio/step0.mp3','./assets/audio/step1.mp3','./assets/audio/step2.mp3','./assets/audio/step3.mp3','./assets/audio/step4.mp3','./assets/models/ammo.glb','./assets/models/bin.glb','./assets/models/c_nurse.glb','./assets/models/c_occ.glb','./assets/models/cabinet.glb','./assets/models/cam.glb','./assets/models/can.glb','./assets/models/cart.glb','./assets/models/chair.glb','./assets/models/door.glb','./assets/models/gate.glb','./assets/models/hlamp.glb','./assets/models/kit_cables.glb','./assets/models/kit_fence.glb','./assets/models/kit_gutter.glb','./assets/models/kit_ind.glb','./assets/models/kit_manhole.glb','./assets/models/kit_pipes.glb','./assets/models/lamp.glb','./assets/models/m_bell.glb','./assets/models/m_diver.glb','./assets/models/m_nurse.glb','./assets/models/m_occ.glb','./assets/models/m_pirate.glb','./assets/models/m_root.glb','./assets/models/m_varka.glb','./assets/models/m_whisperer.glb','./assets/models/mg_chair.glb','./assets/models/mg_tool1.glb','./assets/models/mg_tool3.glb','./assets/models/mg_tool4.glb','./assets/models/mg_wall.glb','./assets/models/pistol.glb','./assets/models/rack.glb','./assets/models/rim.glb','./assets/models/seclight.glb','./assets/models/shelf.glb','./assets/models/slamp1.glb','./assets/models/slamp2.glb','./assets/models/stool.glb','./assets/models/stove.glb','./assets/models/tank.glb','./assets/models/whisperer.glb','./assets/models/wlamp.glb','./assets/tex/bath_bg.jpg','./assets/tex/brick_c.jpg','./assets/tex/brick_n.jpg','./assets/tex/brick_orm.jpg','./assets/tex/floorA_c.jpg','./assets/tex/floorA_n.jpg','./assets/tex/floorA_orm.jpg','./assets/tex/floorB_c.jpg','./assets/tex/floorB_n.jpg','./assets/tex/floorB_orm.jpg','./assets/tex/hall_bg.jpg','./assets/tex/handA.png','./assets/tex/handC.png','./assets/tex/mg_floor.jpg','./assets/tex/night_bg.jpg','./assets/tex/rust_c.jpg','./assets/tex/rust_n.jpg','./assets/tex/rust_orm.jpg','./assets/tex/stone_c.jpg','./assets/tex/stone_n.jpg','./assets/tex/stone_orm.jpg']; // @assetfiles

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ng-') && k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
    warmAssets();                                   // scarica gli asset pesanti per giocare offline (non blocca)
  })());
});
async function warmAssets() {
  const c = await caches.open(ASSETS);
  for (const u of ASSET_FILES) { try { if (!(await c.match(u))) await c.add(u); } catch (_) {} }
}
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); if (e.data === 'WARM') warmAssets(); });

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const isAsset = /\/assets\//.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(isAsset ? ASSETS : SHELL);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && (isAsset || req.mode !== 'navigate')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const shell = await (await caches.open(SHELL)).match('./index.html') || await (await caches.open(SHELL)).match('./'); if (shell) return shell; }
      throw err;
    }
  })());
});
