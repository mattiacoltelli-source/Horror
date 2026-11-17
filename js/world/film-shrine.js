// Piccolo archivio segreto nella cantina, prima della cripta. Le locandine sono
// uno snapshot dei voti horror di Cos: due atlanti locali, nessuna API nel gioco.
import * as THREE from 'three';
import { buildRoom } from './rooms.js';
import { FILMS } from './film-catalog.js';
import { wornPaper } from './worn-paper.js';
import { createWornDoorOutline } from './worn-door.js';
import { aged } from './aged.js';
import { burnDecals, stainDecals, patchDecals } from './blood.js';

export const FILM_DOOR = { side: 1, z: -210.8, w: 1.2, h: 2.3, panel: 'film' };
export const FILM_KEY = [-3.88, 1.3, -212];
const W = 3.3, DEPTH = 3.4, H = 2.8;

export function createFilmShrine({ group, mats, panel }) {
  const G = new THREE.Group(); G.name = 'santuario-horror-cos';
  G.position.set(4, 0, FILM_DOOR.z); G.rotation.y = -Math.PI / 2; group.add(G);
  const room = buildRoom(mats, { z0: 0, w: W, l: DEPTH, h: H, wall: 'brick', floor: 'floorB', ceil: 'stone', dark: 0.72, seed: 819, door: { w: FILM_DOOR.w, h: FILM_DOOR.h } });
  G.add(room.group);
  for (const mesh of room.group.children) {
    if (mesh.material !== mats.floorB) { aged(mesh, 0.52); continue; }
    // Pavimento piano: umidita' nel materiale, senza frammenti o sagome sopra.
    const floor = mesh.material.clone(); floor.roughness = 0.78; floor.normalScale.multiplyScalar(0.65); mesh.material = floor; mesh.name = 'pavimento-umido-santuario';
    floor.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDampFloor;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDampFloor = transformed.xz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 vDampFloor;
        float dampFloorMask() {
          float noise = 0.035*sin(vDampFloor.x*13.0+sin(vDampFloor.y*9.0));
          float a = length((vDampFloor-vec2(-0.95,-2.6))*vec2(1.0,1.7))+noise;
          float b = length((vDampFloor-vec2(0.8,-1.15))*vec2(1.1,1.4))-noise;
          return max(1.0-smoothstep(0.38,0.72,a),1.0-smoothstep(0.27,0.56,b));
        }
      `).replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 1.0 - 0.18*dampFloorMask();')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, max(0.22,roughnessFactor*0.55),dampFloorMask());');
    };
    floor.customProgramCacheKey = () => 'damp-shrine-floor-v1';
  }
  burnDecals(G, [
    { k: 'ceil', p: [-0.35, H - 0.012, -2.25], w: 3.3, h: 2.8, a: 0.95, rot: 0.2 },
    { k: 'wall', p: [0.4, 1.4, -DEPTH + 0.002], wall: '+z', w: 2.4, h: 2.8, a: 0.86 },
    { k: 'wall', p: [-W / 2 + 0.002, 1.15, -1.3], wall: '+x', w: 2.5, h: 2.3, a: 0.7 },
  ]);
  stainDecals(G, [
    { p: [0.75, 1.4, -DEPTH + 0.002], wall: '+z', w: 1.7, h: 2.7, a: 0.9 },
    { p: [W / 2 - 0.002, 1.5, -1.9], wall: '-x', w: 2.1, h: 2.8, a: 0.85 },
  ]);
  patchDecals(G, [
    { img: 'assets/tex/pt_mold.webp', p: [0.1, 0.3, -DEPTH + 0.003], wall: '+z', w: 3.1, h: 0.75, tint: 0.38, a: 0.8 },
    { img: 'assets/tex/pt_mold.webp', p: [-W / 2 + 0.003, 0.3, -1.7], wall: '+x', w: 2.8, h: 0.7, tint: 0.34, a: 0.8 },
    { img: 'assets/tex/pt_stain.webp', p: [W / 2 - 0.003, 1.6, -2], wall: '-x', w: 2.8, h: 2.3, tint: 0.32, a: 0.6 },
  ]);
  const loader = new THREE.TextureLoader();
  const woodMap = loader.load('assets/tex/floor_planks.jpg'); woodMap.colorSpace = THREE.SRGBColorSpace;
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, color: 0x453426, roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x292723, metalness: 0.55, roughness: 0.86 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x79603a, metalness: 0.65, roughness: 0.65 });
  const box = (parent, material, x, y, z, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); o.position.set(x, y, z); parent.add(o); return o; };

  // La faccia esterna proviene dal muro: identiche texture, UV, luce e fughe.
  const hinge = new THREE.Group(); hinge.name = 'pannello-segreto';
  hinge.position.set(4, 0, FILM_DOOR.z + FILM_DOOR.w / 2); group.add(hinge);
  panel.children.forEach((m) => { m.geometry.translate(-hinge.position.x, 0, -hinge.position.z); });
  hinge.add(panel);
  box(hinge, wood, 0.055, FILM_DOOR.h / 2, -FILM_DOOR.w / 2, 0.105, FILM_DOOR.h - 0.008, FILM_DOOR.w - 0.008);
  // Foro piccolo, nessuna maniglia vistosa o suggerimento prima della chiave.
  const lock = box(hinge, brass, -0.006, 1.25, -FILM_DOOR.w + 0.14, 0.012, 0.1, 0.06);
  lock.name = 'serratura-nascosta';
  box(hinge, new THREE.MeshBasicMaterial({ color: 0x080706 }), -0.014, 1.25, -FILM_DOOR.w + 0.14, 0.003, 0.032, 0.01);
  // Dopo la chiave emergono crepe e malta scheggiata lungo il giunto.
  const discovery = createWornDoorOutline(FILM_DOOR.w, FILM_DOOR.h); hinge.add(discovery);
  const threshold = box(G, iron, 0, 0.012, -0.04, FILM_DOOR.w, 0.024, 0.18); threshold.name = 'soglia-santuario';

  // Chiave sul lato opposto, realmente infilata in un piccolo gancio.
  const peg = new THREE.Group(); peg.position.set(-3.97, FILM_KEY[1] + 0.045, FILM_KEY[2]); peg.rotation.y = Math.PI / 2; group.add(peg);
  box(peg, wood, 0, 0, 0, 0.16, 0.19, 0.025);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.085, 6), iron);
  hook.rotation.x = Math.PI / 2; hook.position.set(0, 0.015, 0.048); peg.add(hook);
  const key = new THREE.Group(); key.name = 'chiave-santuario'; key.position.set(0, -0.005, 0.084); key.rotation.z = -0.19; peg.add(key);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0045, 6, 16), brass); key.add(bow);
  box(key, brass, 0, -0.063, 0, 0.009, 0.086, 0.008);
  box(key, brass, 0.009, -0.096, 0, 0.021, 0.01, 0.009);
  box(key, brass, 0.008, -0.079, 0, 0.018, 0.009, 0.009);

  // Carta deformata, bordi mancanti e carbonizzati, pieghe e aloni diversi per foglio.
  // Due sole mesh per tutte e 48 le immagini, invece di 48 texture/materiali.
  let seed = 6102; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bins = [{ p: [], n: [], u: [], c: [], local: [], seed: [] }, { p: [], n: [], u: [], c: [], local: [], seed: [] }], tapes = [], pins = [], posters = [];
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x685139, roughness: 1 });
  const paper = (index, x, y, z, ry, w, angle) => {
    const featured = index < 10, b = bins[featured ? 0 : 1], h = w * 1.5;
    const cols = featured ? 5 : 8, rows = featured ? 2 : 5, cell = featured ? index : index - 10;
    const insetX = featured ? 8 / 400 : 6 / 192, insetY = featured ? 12 / 600 : 9 / 288;
    const holder = new THREE.Object3D(); holder.position.set(x, y, z); holder.rotation.set(0, ry, 0); holder.rotateZ(angle); holder.updateMatrix();
    const geo = new THREE.PlaneGeometry(w, h, 10, 14), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) / w, v = p.getY(i) / h, edge = Math.max(0, Math.abs(a) - 0.32) / 0.18;
      const fold = 0.29 + 0.34 * ((index * 0.43) % 1) - 0.5;
      const ridge = Math.exp(-Math.abs(a - fold) * 90) * 0.006;
      p.setZ(i, (featured ? 1 : 0.3) * (0.004 + ridge + edge * edge * (0.018 + 0.012 * Math.sin(v * 7 + index)) + 0.004 * Math.sin(v * 15 + a * 13 + index)));
    }
    geo.computeVertexNormals(); geo.applyMatrix4(holder.matrix); const flat = geo.toNonIndexed();
    const pos = flat.attributes.position, n = flat.attributes.normal, uv = flat.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      b.local.push(uv.getX(i), uv.getY(i)); b.seed.push(index + 1);
      b.p.push(pos.getX(i), pos.getY(i), pos.getZ(i)); b.n.push(n.getX(i), n.getY(i), n.getZ(i));
      b.u.push((cell % cols + insetX + uv.getX(i) * (1 - insetX * 2)) / cols,
        1 - (Math.floor(cell / cols) + insetY + (1 - uv.getY(i)) * (1 - insetY * 2)) / rows);
      const edge = Math.min(uv.getX(i), 1 - uv.getX(i), uv.getY(i), 1 - uv.getY(i));
      const shade = 0.87 + Math.min(0.1, edge) * 0.8; b.c.push(shade, shade * 0.96, shade * 0.87);
    }
    geo.dispose(); flat.dispose();
    for (const side of [-1, 1]) {
      const attach = holder.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(side * (w / 2 - 0.045), h / 2 - 0.01, 0.013));
      if ((index + (side > 0 ? 1 : 0)) % 3 === 0) {
        const obj = new THREE.Object3D(); obj.applyMatrix4(attach); obj.rotateZ((rnd() - 0.5) * 0.65); obj.updateMatrix(); tapes.push(obj.matrix.clone());
      } else pins.push(attach);
    }
    posters.push({ index, ...FILMS[index], featured, position: [x, y, z], width: w, height: h });
  };
  // Tre protagonisti sul fondo, tre per lato, l'ultimo accanto all'ingresso.
  [[1, -1.03, 1.48, 0.73, -0.025], [0, 0, 1.52, 0.91, 0.012], [3, 1.03, 1.5, 0.73, 0.02]].forEach(([i, x, y, w, a]) => paper(i, x, y, -DEPTH + 0.025, 0, w, a));
  [[2, -0.7, 1.5, 0.73, 0.03], [4, -1.75, 1.44, 0.79, -0.02], [5, -2.78, 1.53, 0.72, 0.015]].forEach(([i, z, y, w, a]) => paper(i, -W / 2 + 0.025, y, z, Math.PI / 2, w, a));
  [[6, -0.72, 1.49, 0.75, -0.03], [7, -1.77, 1.53, 0.74, 0.02], [8, -2.79, 1.45, 0.75, -0.016]].forEach(([i, z, y, w, a]) => paper(i, W / 2 - 0.025, y, z, -Math.PI / 2, w, a));
  paper(9, -1.13, 1.48, -0.025, Math.PI, 0.69, -0.025);
  let index = 10;
  for (let wall = 0; wall < 3; wall++) {
    for (let row = 0; row < 2; row++) {
      const count = row === 0 ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const along = -1.4 + (i / (count - 1)) * 2.8 + (rnd() - 0.5) * 0.035;
        const y = (row === 0 ? 2.4 : 0.48) + (rnd() - 0.5) * 0.07, w = (row === 0 ? 0.43 : 0.56) + rnd() * 0.025;
        const a = (rnd() - 0.5) * 0.12;
        if (wall === 0) paper(index++, along, y, -DEPTH + 0.009, 0, w, a);
        else paper(index++, (wall === 1 ? -1 : 1) * (W / 2 - 0.009), y, along - DEPTH / 2, wall === 1 ? Math.PI / 2 : -Math.PI / 2, w, a);
      }
    }
  }
  paper(index++, -1.12, 0.47, -0.012, Math.PI, 0.53, 0.035);
  paper(index++, 1.12, 1.75, -0.012, Math.PI, 0.6, -0.04);
  for (let i = 0; i < 2; i++) {
    const data = bins[i], geometry = new THREE.BufferGeometry();
    for (const [name, array, size] of [['position', data.p, 3], ['normal', data.n, 3], ['uv', data.u, 2], ['color', data.c, 3], ['paperUv', data.local, 2], ['paperSeed', data.seed, 1]]) geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, size));
    geometry.computeBoundingSphere();
    const map = loader.load(`assets/tex/film-shrine/${i === 0 ? 'featured' : 'collection'}.webp`); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = wornPaper(new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, material); mesh.name = i === 0 ? 'locandine-principali' : 'locandine-collezione'; G.add(mesh);
  }
  const attachments = (geo, material, matrices, name) => { const m = new THREE.InstancedMesh(geo, material, matrices.length); matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix)); m.name = name; G.add(m); };
  attachments(new THREE.BoxGeometry(0.045, 0.105, 0.003), tapeMat, tapes, 'nastro-locandine');
  attachments(new THREE.SphereGeometry(0.006, 6, 4), iron, pins, 'puntine-locandine');
  G.userData.posters = posters;

  // Arredi anneriti negli angoli, pavimento libero.
  const furniture = new THREE.Group(); furniture.name = 'arredi-consumati'; G.add(furniture);
  for (const side of [-1, 1]) box(furniture, wood, side * (W / 2 - 0.03), 0.065, -DEPTH / 2, 0.055, 0.13, DEPTH);
  box(furniture, wood, 0, 0.065, -DEPTH + 0.025, W, 0.13, 0.055);
  const crate = new THREE.Group(); crate.position.set(-1.17, 0.21, -2.96); crate.rotation.y = 0.17; furniture.add(crate);
  box(crate, wood, 0, 0, 0, 0.5, 0.42, 0.38);
  for (const xx of [-0.21, 0.21]) box(crate, wood, xx, 0, 0.198, 0.045, 0.42, 0.025);
  const tin = new THREE.MeshStandardMaterial({ color: 0x575750, metalness: 0.7, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.035, 24), tin);
    can.position.set(-1.19 + i * 0.012, 0.44 + i * 0.038, -2.97); can.rotation.z = i === 2 ? 0.07 : 0; furniture.add(can);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.003, 4, 24), iron); rim.rotation.x = Math.PI / 2; rim.position.copy(can.position); rim.position.y += 0.018; furniture.add(rim);
  }
  aged(furniture, 0.68);
  const light = new THREE.PointLight(0xe5a266, 0, 4.1, 1.5); light.position.set(0, 2.48, -1.75); G.add(light);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8b5b31 })); bulb.position.copy(light.position); G.add(bulb);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.11, 16, 1, true), iron); shade.position.copy(light.position); shade.position.y += 0.095; G.add(shade);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 5), iron); wire.position.set(0, 2.68, -1.75); G.add(wire);
  return { group: G, hinge, key, light, bulb, discovery, posters, depth: DEPTH, width: W };
}
