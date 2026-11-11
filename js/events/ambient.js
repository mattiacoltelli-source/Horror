// Ambiente vivo: (1) rumori che reagiscono a come ti muovi (se resti fermo a lungo qualcosa si muove alle tue spalle; appena riparti, ti risponde un passo),
// (2) oggetti che cambiano quando non li guardi (stesso meccanismo della sedia a rotelle: li vedi, distogli lo sguardo, li ritrovi spostati).
import * as THREE from 'three';

export function createAmbient({ player, audio, story, combat }) {
  const A = {}, v = new THREE.Vector3(), back = new THREE.Vector3();
  let still = 0, n = 0, cool = 8, pending = false, ans = 0, lastYaw = 0, room = '';
  const behind = (d, side = 0) => { back.set(player.forward.x, 0, player.forward.z).normalize(); return v.set(player.pos.x - back.x * d - back.z * side, 0, player.pos.z - back.z * d + back.x * side); };
  A.update = (dt) => {
    const cur = story.current(); if (cur !== room) { room = cur; still = 0; n = 0; cool = 7; pending = false; }
    if (!['cellar', 'morgue', 'warehouse'].includes(cur) || story.busy() || combat?.active) return;
    const moving = player.speedNow > 0.15 || Math.abs(player.yaw - lastYaw) > 0.02; lastYaw = player.yaw; cool -= dt;
    if (!moving) { still += dt; if (still > 7 && cool <= 0 && n < 3) {   // fermo da troppo: qualcosa si muove dietro di te
      n++; cool = 16; still = 0; pending = true; ans = 0; const r = Math.random(), side = (Math.random() - 0.5) * 6;
      if (r < 0.4) audio.heavyStep(behind(8, side), 0.6); else if (r < 0.75) audio.squeak?.(0.6, behind(9, side).clone()); else audio.whisper?.(1.2, 0.08);
    } } else {
      still = 0;
      if (pending) { ans += dt; if (ans > 0.9) { pending = false; ans = 0; audio.heavyStep(behind(4.5, (Math.random() - 0.5) * 2), 0.5); } }   // appena ti muovi, un passo ti risponde
    }
  };
  return A;
}

// oggetto che si sposta quando lo perdi di vista: dopo che l'hai guardato per `minSeen` s e hai distolto lo sguardo per 0.5 s, chiama move(n)
export function unseenMover({ camera, getObj, move, max = 3, gap = 6, minSeen = 1.0 }) {
  let seen = 0, unseen = 0, n = 0, cool = 0; const p = new THREE.Vector3(), f = new THREE.Vector3(), d = new THREE.Vector3();
  return (dt, enabled = true) => {
    const o = getObj(); if (!o || !enabled || n >= max) return; cool -= dt;
    o.getWorldPosition(p); camera.getWorldDirection(f); d.copy(p).sub(camera.position); const dist = d.length(); d.normalize();
    if (dist < 11 && d.dot(f) > 0.55) { seen += dt; unseen = 0; }
    else { unseen += dt; if (seen > minSeen && unseen > 0.5 && cool <= 0) { n++; cool = gap; seen = 0; move(n); } }
  };
}
