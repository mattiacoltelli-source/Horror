// Interazione facoltativa: chiave, pannello e passaggio. Non cambia la trama.
import * as THREE from 'three';
import { createFilmShrine, FILM_DOOR, FILM_KEY } from '../world/film-shrine.js';

export function createFilmShrineEvent({ group, mats, panel, player, flags, audio, say, actBtn, onSave }) {
  const view = createFilmShrine({ group, mats, panel });
  const S = { ...view, near: null, angle: 0, entered: false };
  const target = new THREE.Vector3(), dir = new THREE.Vector3();
  const center = FILM_DOOR.z, radius = 0.32, wallX = 4, openingHalf = FILM_DOOR.w / 2 - radius;
  const prompt = (next) => {
    if (next === S.near) return;
    const owned = !!S.near; S.near = next;
    if (next) { actBtn.textContent = next === 'key' ? 'PRENDI CHIAVE' : 'USA LA CHIAVE'; actBtn.classList.remove('hidden'); }
    else if (owned) actBtn.classList.add('hidden');
  };
  const sync = () => { S.key.visible = !flags.filmKey && !flags.filmDoorOpen; S.discovery.visible = !!flags.filmKey && !flags.filmDoorOpen; };
  S.reset = () => { prompt(null); sync(); S.angle = flags.filmDoorOpen ? 1.55 : 0; S.hinge.rotation.y = -S.angle; S.entered = false; };
  S.update = (dt, active) => {
    sync();
    S.angle = Math.min(flags.filmDoorOpen ? 1.55 : 0, S.angle + dt * 0.9);
    S.hinge.rotation.y = -S.angle;
    const inside = player.pos.x > wallX + 0.2;
    S.light.intensity = active && S.angle > 0.1 ? 2.5 : 0;
    S.bulb.material.color.setHex(S.light.intensity ? 0xffcf8e : 0x382b21);
    if (!active) { prompt(null); return; }
    let next = null;
    const looking = (p, max, dot) => { target.set(...p); dir.copy(target).sub(player.pos); const distance = dir.length(); return distance < max && dir.normalize().dot(player.forward) > dot; };
    if (!player.frozen && !flags.filmKey && !flags.filmDoorOpen && looking(FILM_KEY, 1.8, 0.88)) next = 'key';
    // Si guarda il pannello, non un singolo pixel della serratura: vicino al
    // muro si deve poter tenere la visuale all'altezza degli occhi.
    if (!player.frozen && flags.filmKey && !flags.filmDoorOpen && player.pos.x < wallX && player.forward.x > 0.3) {
      const t = (wallX - player.pos.x) / player.forward.x;
      const hitY = player.pos.y + player.forward.y * t, hitZ = player.pos.z + player.forward.z * t;
      const distance = Math.hypot(wallX - player.pos.x, Math.max(0, Math.abs(player.pos.z - center) - FILM_DOOR.w / 2));
      if (distance < 2.6 && t < 3.2 && hitY > 0.1 && hitY < FILM_DOOR.h + 0.2 && Math.abs(hitZ - center) < FILM_DOOR.w / 2 + 0.3) next = 'door';
    }
    prompt(next);
    if (inside && !S.entered) { S.entered = true; say('La collezione di Cos.', 3200); }
  };
  S.act = () => {
    if (!S.near) return;
    // Ricalcola distanza e sguardo: niente azioni da un pulsante rimasto visibile.
    S.update(0, true);
    if (S.near === 'key') {
      flags.filmKey = true; sync(); audio.tinkle?.(); say('Una piccola chiave.\nC’è una serratura sul muro opposto,\nverso l’ingresso della cantina.', 5800); prompt(null); onSave?.();
    } else if (S.near === 'door') {
      flags.filmDoorOpen = true; audio.squeak?.(1.7, new THREE.Vector3(4, 1.1, center)); say('Il pannello cede verso l’interno.', 3000); prompt(null); onSave?.();
    }
  };
  // Unione stanza + soglia + annesso. Mai allargare il rettangolo della cantina:
  // permetterebbe di attraversare anche i tratti di muro accanto alla porta.
  S.move = (x, z, bounds) => {
    const old = player.pos, ready = S.angle > 1.48;
    const inDoor = (zz) => Math.abs(zz - center) <= openingHalf;
    const farX = wallX + S.depth - radius, sideZ = S.width / 2 - radius;
    const endX = wallX + Math.sin(S.angle) * FILM_DOOR.w;
    const hingeZ = center + FILM_DOOR.w / 2, endZ = hingeZ - Math.cos(S.angle) * FILM_DOOR.w;
    const leafDistance = (xx, zz) => {
      const dx = endX - wallX, dz = endZ - hingeZ;
      const t = THREE.MathUtils.clamp(((xx - wallX) * dx + (zz - hingeZ) * dz) / (FILM_DOOR.w ** 2), 0, 1);
      return Math.hypot(xx - wallX - dx * t, zz - hingeZ - dz * t);
    };
    const valid = (xx, zz) => {
      if (xx <= bounds[1]) return xx >= bounds[0] && zz >= bounds[2] && zz <= bounds[3];
      if (!ready) return false;
      if (leafDistance(xx, zz) < radius + 0.055) return false;
      if (xx < wallX + radius + 0.1) return inDoor(zz);
      return xx <= farX && Math.abs(zz - center) <= sideZ;
    };
    const maxX = ready ? farX : bounds[1];
    let xx = THREE.MathUtils.clamp(x, bounds[0], maxX), zz = old.z;
    if (!valid(xx, zz)) xx = old.x;
    const minZ = xx > wallX + radius + 0.1 ? center - sideZ : bounds[2];
    const maxZ = xx > wallX + radius + 0.1 ? center + sideZ : bounds[3];
    zz = THREE.MathUtils.clamp(z, minZ, maxZ);
    if (!valid(xx, zz)) zz = old.z;
    return [xx, zz];
  };
  S.leave = () => { prompt(null); S.light.intensity = 0; };
  return S;
}
