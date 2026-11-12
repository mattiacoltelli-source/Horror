// TOPI: piccoli, scuri, fermi vicino ai muri e alle cose. Se ti avvicini (o corri) scappano di scatto lungo il muro verso un nascondiglio
// (sotto uno scaffale, dietro un mobile) e spariscono, con un trillo e un rumore di unghie. Ognuno scappa una volta sola.
// Il modello è statico (Poly Haven, CC0): l'andatura finta è fatta di ondeggiamento del corpo e piccoli saltelli, a 3 m/s si legge bene.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const loader = new GLTFLoader(); let src = null, loading = null;
const getRat = () => (loading ??= new Promise((res) => loader.load('assets/models/x_rat.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); const c = o.material.color; const gr = (c.r + c.g + c.b) / 3; c.setRGB(c.r + (gr - c.r) * 0.6, c.g + (gr - c.g) * 0.6, c.b + (gr - c.b) * 0.6).multiplyScalar(1.35); o.material.roughness = 0.85; o.frustumCulled = true; } });
  const b = new THREE.Box3().setFromObject(g.scene), c = b.getCenter(new THREE.Vector3()); g.scene.position.set(-c.x, -b.min.y, -c.z);   // base a terra, centrato; testa verso +z
  src = g.scene; res(src);
}, undefined, () => res(null))));

export function createRats({ camera, player, audio }) {
  const R = { list: [] }, SCALE = 2.4;
  const wp = new THREE.Vector3();
  // group: gruppo della stanza · o: { x, z, ry, hide: [[x,z],...], run: 3.2, dist: 2.8 }
  R.add = (group, o) => getRat().then((m) => {
    if (!m) return;
    const holder = new THREE.Group(), body = new THREE.Group(); body.add(m.clone(true)); body.scale.setScalar(SCALE); holder.add(body);
    holder.position.set(o.x, 0, o.z); holder.rotation.y = o.ry ?? Math.random() * 6.28; group.add(holder);
    R.list.push({ holder, body, o, state: 'idle', t: Math.random() * 5, next: 1 + Math.random() * 3, wi: 0, delay: 0, base: holder.rotation.y, tw: 0, gait: Math.random() * 6 });
  });
  const dir = new THREE.Vector3();
  R.update = (dt) => {
    for (const r of R.list) {
      const h = r.holder; if (r.state === 'gone') continue;
      let vis = true; for (let p = h; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) continue;
      r.t += dt; const px = player.pos.x - h.position.x, pz = player.pos.z - h.position.z, d = Math.hypot(px, pz);
      if (r.state === 'idle') {
        // fiuta: ogni tanto gira il muso e lo muove, un piccolo sussulto
        r.next -= dt; if (r.next <= 0) { r.next = 1.2 + Math.random() * 3.5; r.tw = 0.28; r.base += (Math.random() - 0.5) * 0.9; }
        if (r.tw > 0) r.tw = Math.max(0, r.tw - dt);
        h.rotation.y += (r.base - h.rotation.y) * Math.min(1, dt * 9);
        r.body.rotation.x = Math.sin(r.t * 22) * 0.025 * (r.tw > 0 ? 3 : 1) + Math.sin(r.t * 3) * 0.01;           // naso che si muove, respiro
        r.body.position.y = r.tw > 0 ? Math.abs(Math.sin(r.tw * 11)) * 0.008 : 0;
        if (d < (r.o.dist ?? 2.8) || (d < 4.2 && player.speedNow > 1.9)) { r.state = 'start'; r.delay = 0.08 + Math.random() * 0.18; r.pos = h.position.clone(); }
      } else if (r.state === 'start') {
        r.delay -= dt; const aw = Math.atan2(-px, -pz); h.rotation.y += Math.atan2(Math.sin(aw - h.rotation.y), Math.cos(aw - h.rotation.y)) * Math.min(1, dt * 18);   // si volta dall'altra parte
        if (r.delay <= 0) { r.state = 'run'; r.wi = 0; wp.set(h.position.x, 0.2, h.position.z); audio.scurry?.(wp, 0.9); }
      } else if (r.state === 'run') {
        const to = r.o.hide[r.wi]; dir.set(to[0] - h.position.x, 0, to[1] - h.position.z); const dist = dir.length();
        const step = (r.o.run ?? 3.2) * dt;
        if (dist <= step) { h.position.x = to[0]; h.position.z = to[1]; r.wi++; if (r.wi >= r.o.hide.length) { r.state = 'hide'; r.hideT = 0; continue; } }
        else { dir.multiplyScalar(1 / dist); h.position.x += dir.x * step; h.position.z += dir.z * step; const tgt = Math.atan2(dir.x, dir.z); h.rotation.y += Math.atan2(Math.sin(tgt - h.rotation.y), Math.cos(tgt - h.rotation.y)) * Math.min(1, dt * 16); }
        r.gait += dt * 34; r.body.position.y = Math.abs(Math.sin(r.gait)) * 0.014; r.body.rotation.x = Math.sin(r.gait) * 0.13; r.body.rotation.z = Math.sin(r.gait * 0.5) * 0.09;   // andatura a balzelli
      } else if (r.state === 'hide') {
        r.hideT += dt; r.body.scale.setScalar(SCALE * Math.max(0.01, 1 - r.hideT / 0.12));   // scivola sotto/dietro l'oggetto
        if (r.hideT >= 0.12) { h.visible = false; r.state = 'gone'; }
      }
    }
  };
  return R;
}
