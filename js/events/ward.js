// STANZA PROVA — IL REPARTO: corridoio d'ospedale (kit modulare "Modular Hospital Environment", texture PBR ridotte), sporcato e al buio, con luci al neon che sfarfallano.
// Si accede solo con ?start=reparto (non e' ancora nel percorso). Evento: a meta' corridoio le luci si spengono per ~1 s; la sedia a rotelle, nel buio, si e' avvicinata.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { stainDecals, bloodDecals, burnDecals, patchDecals, writingDecals } from '../world/blood.js';
import { buildRoom } from '../world/rooms.js';
import { PKEY, P } from '../personal.js';
import { bloodText } from '../world/bloodfont.js';
import { createElevator } from '../world/elevator.js';
import { createElectricalPanel } from '../world/electrical-panel.js';

export const WARD = { z0: -480, w: 4, l: 20, h: 2.5 };   // la fine del corridoio coincide con l'ingresso dell'obitorio (z0 -500): un unico ambiente
const loader = new GLTFLoader(), cache = {};
const get = (n) => cache[n] ??= new Promise((res) => loader.load(n.startsWith('../') ? `assets/models/${n.slice(3)}.glb` : `assets/models/hw_${n}.glb`, (g) => res(g.scene), undefined, () => res(null)));

// toglie colore dalla texture (il blu acceso della sedia e del materasso stonerebbe con il resto): grigio-bruno sporco
const desat = (mat, k = 0.8) => { mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { float gy = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gy) * vec3(1.0, 0.95, 0.85), ${k.toFixed(2)}); }`); }; mat.needsUpdate = true; };
export function createWard({ scene, mats, player, camera, audio, lights, instab, say, getMorgue, story, renderer }) {
  const R = { group: new THREE.Group(), state: 'idle', t: 0 };
  R.group.visible = false; scene.add(R.group);
  const { z0, w, l, h } = WARD, zFar = z0 - l, hw = w / 2;
  const elevator = { side: 1, z: z0 - 16.75, w: 2.15, h: 2.25 };
  let atlas = null;
  const lampPos = [[0, h - 0.12, z0 - 10]];   // una sola lampada, a meta' corridoio
  // un pezzo del kit: base a terra, centrato; material = atlante condiviso (uno solo in memoria), scurito e sporcato
  const place = async (name, x, y, z, ry = 0, opt = {}) => {
    const src = await get(name); if (!src) return null; const o = src.clone(true);
    o.traverse((m) => { if (!m.isMesh) return; if (opt.atlas) m.material = atlas; else { m.material = m.material.clone(); { const c = m.material.color; c.multiplyScalar(opt.dark ?? 0.5); const gr = (c.r + c.g + c.b) / 3; c.r += (gr - c.r) * 0.55; c.g += (gr - c.g) * 0.55; c.b += (gr - c.b) * 0.55; } m.material.roughness = Math.max(0.55, m.material.roughness ?? 0.7); if (opt.desat) desat(m.material, opt.desat); } });
    if (opt.scale) o.scale.setScalar(opt.scale); const g = new THREE.Group(); g.add(o); g.position.set(x, y, z); g.rotation.y = ry; R.group.add(g); return g;
  };
  // guscio: pavimento e pareti piastrellate come l'obitorio (le texture di pareti e pavimento del kit non erano nel pacchetto ricevuto); soffitto e arredo: pezzi del kit
  const room = buildRoom(mats, { z0, w, l, h, wall: 'stone', floor: 'mfloor', ceil: 'stone', dark: 0.5, seed: 61, openEnd: true, door: { w: 2, h: 2.5 }, sideDoor: elevator }); R.group.add(room.group);
  createElevator({ group: R.group, mats, x: hw - 0.26, z: elevator.z });
  createElectricalPanel(R.group,mats,{x:-1.755,y:1.80,z:z0-3.8});
  (async () => {
    const mg = await get('../mg_wall'); // (percorso relativo: assets/models/mg_wall.glb)
    if (mg) {
      const b0 = new THREE.Box3().setFromObject(mg), sz = b0.getSize(new THREE.Vector3()), c0 = b0.getCenter(new THREE.Vector3());
      mg.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setScalar(0.62); } });
      // Sopra il montacarichi si ritaglia la parte alta del muro originale:
      // comprimere tutto il modulo riporterebbe qui anche le mattonelle basse.
      const upper = new THREE.Group(), cutoff = b0.min.y + elevator.h;
      mg.updateMatrixWorld(true);
      mg.traverse((m) => {
        if (!m.isMesh) return;
        const baked = m.geometry.clone().applyMatrix4(m.matrixWorld), geo = baked.index ? baked.toNonIndexed() : baked;
        const pos = geo.getAttribute('position'), norm = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
        const p = [], n = [], u = [];
        const vertex = (i) => ({ p: new THREE.Vector3().fromBufferAttribute(pos, i), n: new THREE.Vector3().fromBufferAttribute(norm, i), u: new THREE.Vector2().fromBufferAttribute(uv, i) });
        for (let i = 0; i < pos.count; i += 3) {
          const tri = [vertex(i), vertex(i + 1), vertex(i + 2)], poly = [];
          let prev = tri[2];
          for (const cur of tri) {
            if ((prev.p.y >= cutoff) !== (cur.p.y >= cutoff)) {
              const t = (cutoff - prev.p.y) / (cur.p.y - prev.p.y);
              poly.push({ p: prev.p.clone().lerp(cur.p, t), n: prev.n.clone().lerp(cur.n, t).normalize(), u: prev.u.clone().lerp(cur.u, t) });
            }
            if (cur.p.y >= cutoff) poly.push(cur);
            prev = cur;
          }
          for (let j = 1; j + 1 < poly.length; j++) for (const v of [poly[0], poly[j], poly[j + 1]]) { p.push(...v.p); n.push(...v.n); u.push(...v.u); }
        }
        const clipped = new THREE.BufferGeometry();
        clipped.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); clipped.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); clipped.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
        const mesh = new THREE.Mesh(clipped, m.material); mesh.name = 'parete-verde-sopra-montacarichi'; upper.add(mesh);
        geo.dispose(); if (geo !== baked) baked.dispose();
      });
      const put = (x, z, ry, width = sz.x, source = mg) => { const o = source.clone(true), g = new THREE.Group(); o.position.set(-c0.x, -b0.min.y, -c0.z); g.add(o); g.scale.set(width / sz.x, 1, 1); g.position.set(x, 0, z); g.rotation.y = ry; R.group.add(g); };
      const t = sz.z / 2 - 0.02;
      for (let i = 0; i < 7; i++) {
        const z = z0 - 1.5 - i * 3; put(-hw + t, z, Math.PI / 2);
        // Anche il rivestimento piastrellato deve lasciare aperto il vano della cabina.
        const lo = z - sz.x / 2, hi = z + sz.x / 2, a = elevator.z - elevator.w / 2, b = elevator.z + elevator.w / 2;
        if (hi <= a || lo >= b) put(hw - t, z, -Math.PI / 2);
        else {
          if (lo < a) put(hw - t, (lo + a) / 2, -Math.PI / 2, a - lo);
          if (hi > b) put(hw - t, (b + hi) / 2, -Math.PI / 2, hi - b);
          const left = Math.max(lo, a), right = Math.min(hi, b);
          put(hw - t, (left + right) / 2, -Math.PI / 2, right - left, upper);
        }
      }
      for (const sx of [-1, 1]) put(sx * 2.45, zFar + t + 0.01, 0);   // parete di fondo lato corridoio (con la faccia piastrellata verso di te), lasciando il varco dell'obitorio
    }
    // soffitto: le stesse piastrelle bianche delle pareti (ritaglio pulito della loro texture), ripetute
    { const t = new THREE.TextureLoader().load('assets/tex/ward_ceiling.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 3, l / 0.75); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0, color: new THREE.Color(0.72, 0.72, 0.7) })); m.rotation.x = Math.PI / 2; m.position.set(0, h - 0.02, z0 - l / 2); R.group.add(m); }
    const A = { atlas: true };
    // due porte sulle pareti: un'apertura nera sul muro e la porta (una chiusa, una socchiusa)
    const hole = (x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.05), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); m.position.set(x, 1.02, z); m.rotation.y = ry; R.group.add(m); };
    hole(-hw + 0.12, z0 - 7.5, Math.PI / 2); hole(hw - 0.12, z0 - 13, -Math.PI / 2);
    await place('door_1', -hw + 0.13, 0, z0 - 7.0, Math.PI / 2, { dark: 0.6 });
    const open = await place('door_1', hw - 0.13, 0, z0 - 12.5, -Math.PI / 2 + 1.1, { dark: 0.6 });
    // (nessun cartello EXIT: restava visibile e luminoso anche dall'obitorio)
    { const lp = await get('../wlamp'); if (lp) for (const [x, , z] of lampPos) { const o = lp.clone(true), b = new THREE.Box3().setFromObject(o), g = new THREE.Group(); const sc = 0.5 / Math.max(b.max.x - b.min.x, b.max.y - b.min.y); o.scale.setScalar(sc); o.rotation.x = Math.PI / 2; o.updateMatrixWorld(true); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.max.y, -c.z); g.add(o); g.position.set(x, h - 0.02, z); R.group.add(g); } }
    R.chair = await place('wheel_chair', 0.9, 0.43 * 0.68, z0 - 11, 2.6, { dark: 0.7, desat: 0.85, scale: 0.68 });
    { const bd = await get('../hs_bed'); if (bd) { const o = bd.clone(true), b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), g = new THREE.Group(); o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.55); desat(m.material, 0.6); } }); const sc = 2.0 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z); o.scale.setScalar(sc); b.setFromObject(o); o.position.set(-c.x * sc, -b.min.y, -c.z * sc); g.add(o); g.position.set(-1.2, 0, z0 - 15.2); g.rotation.y = 0.04; R.group.add(g); } }
    R.loaded = true; R.bend?.prepare();   // tutto il reparto e' arrivato: se la piega e' attiva, lo prepara a fette (con il reparto nascosto)
  })().catch((e) => console.error('reparto: caricamento dei pezzi', e));
  // sporco sui muri e sangue vecchio
  stainDecals(R.group, [{ p: [-hw + 0.01, 1.3, z0 - 5], wall: '+x', w: 2.6, h: 2.2 }, { p: [hw - 0.01, 1.2, z0 - 9.5], wall: '-x', w: 2.4, h: 2.2, flip: true }, { p: [-hw + 0.01, 1.2, z0 - 14], wall: '+x', w: 2.4, h: 2.2, a: 0.8 }, { p: [hw - 0.01, 1.2, z0 - 4.8], wall: '-x', w: 2.4, h: 2.2 }]);
  patchDecals(R.group, [{ img: 'assets/tex/pt_plaster.webp', p: [-hw + 0.016, 1.85, z0 - 2.6], wall: '+x', w: 1.9, h: 1.3 }, { img: 'assets/tex/pt_plaster.webp', p: [hw - 0.016, 1.85, z0 - 4.2], wall: '-x', w: 1.7, h: 1.2, rot: 0.04 }]);   // corridoio: intonaco scrostato e muro macchiato sopra le piastrelle
  // compleanno, scritto col sangue sulle piastrelle bianche: dai profili, oppure da ?nasc=g-m-aa (la domanda del link per tutti)
  const BD = { steve: '23/4/88', rebecca: '20/6/97', tommy: '1/11/90', gabriele: '31/12/90', elisa: '2/8/90', alice: '5/9/93' };
  const qn = /^(\d{1,2})-(\d{1,2})-(\d{2})$/.exec(new URLSearchParams(location.search).get('nasc') || '');
  const DATE = qn ? qn[1] + '/' + qn[2] + '/' + qn[3] : BD[PKEY];
  writingDecals(R.group, [{ img: 'assets/tex/pic_mural_child.webp', aspect: 0.7378, p: [1.758, 1.9, z0 - 6.0], wall: '-x', w: 0.85, rot: 0, a: 0.9, plain: true, glow: 0.1 }]);   // reparto: la bambina alla finestra (la sorella), sulla parete verde sopra le piastrelle
  writingDecals(R.group, [{ img: 'assets/tex/sym_eye.png', aspect: 0.8042, dry: true, p: [1.758, 1.95, z0 - 14.5], wall: '-x', w: 0.7, rot: 0.03 }]);   // occhio che piange, sulla parete verde
  // frase personale (max 28 lettere, due righe), scritta col sangue sulle piastrelle bianche piu' avanti nel corridoio
  { const raw = (new URLSearchParams(location.search).get('frase') || P?.frase || '').toUpperCase().replace(/[ÁÂÄ]/g, 'À').replace(/[ÉÊË]/g, 'È').replace(/[ÍÎÏ]/g, 'Ì').replace(/[ÓÔÖ]/g, 'Ò').replace(/[ÚÛÜ]/g, 'Ù').replace(/[^A-ZÀÈÌÒÙ ,.'\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (raw.length >= 2) { const ws = raw.split(' '); let l1 = '', l2 = ''; for (const x of ws) { if (!l2 && (l1 + ' ' + x).trim().length <= 14) l1 = (l1 + ' ' + x).trim(); else l2 = (l2 + ' ' + x).trim(); }
      const T = l2 ? l1 + '\n' + l2 : l1, ta = bloodText(T).aspect; writingDecals(R.group, [{ text: T, aspect: ta, p: [-1.772, 1.82, z0 - 10.2], wall: '+x', w: 3.6, maxH: l2 ? 1.15 : 0.62 }]); } }
  if (DATE) { const T = DATE, ta = bloodText(T).aspect; writingDecals(R.group, [{ text: T, aspect: ta, p: [-1.772, 1.8, z0 - 5.6], wall: '+x', w: 2.4, maxH: 0.72 }]); }
  burnDecals(R.group, [{ k: 'wall', p: [-hw + 0.014, 1.4, z0 - 8], wall: '+x', w: 3.4, h: 2.6, a: 0.5 }, { k: 'wall', p: [hw - 0.014, 1.3, z0 - 14.5], wall: '-x', w: 3.0, h: 2.4, a: 0.45, flip: true }, { k: 'floor', p: [0.3, 0.012, z0 - 16], w: 2.0, h: 1.6, rot: 1.0, a: 0.6 }]);   // corridoio: vicino a dove e' partito il fuoco, bruciature medie
  bloodDecals(R.group, [{ k: 'A', p: [-1.758, 1.1, z0 - 12.2], wall: '+x', h: 0.3, rot: 0.1 }]);

  // anteprima dal varco: la luce della lampada non c'e' ancora, un velo chiaro sul pavimento lo fa vedere (sparisce appena entri)
  R.onPreview = () => { R.pl = lights.addLamp(0, h - 0.12, z0 - 10 + R.pdz, 0xcfeadc); };   // la lampada vera della stanza, accesa gia' dal varco
  // PIEGA (solo con ?piega=1): il reparto si flette per un attimo e torna dritto prima dell'obitorio (js/world/bend.js)
  if (new URLSearchParams(location.search).get('piega') === '1') import('../world/bend.js').then(({ createBend }) => {
    R.bend = createBend({ group: R.group, z0, length: l, camera, lights, audio, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, compile: () => renderer?.compileAsync?.(R.group, camera, scene) });
    if (R.loaded) R.bend.prepare();   // se i pezzi del reparto ci sono gia', si prepara subito (a fette, con il reparto nascosto)
  });
  R.bounds = [-hw + 0.45, hw - 0.45, zFar - 14, z0 - 0.6];   // il limite in fondo (l'obitorio) e' aggiornato a ogni fotogramma
  R.enter = (seamless = false) => {
    R.pl = null; R.group.visible = true; R.state = 'walk'; R.t = 0; R.hit = false; R.crossed = false; { const m = getMorgue(); m.group.visible = true; if (m.back) m.back.visible = false; if (m.entry) m.entry.visible = false; m.cones.forEach((c) => (c.visible = false)); m.puddles.forEach((c) => (c.visible = false)); }
    player.box = R.bounds; if (!seamless) { player.pos.set(0, 1.62, z0 - 1.4); player.yaw = 0; player.pitch = 0; player.frozen = false; }   // arrivando dalla cantina il giocatore e' gia' qui
    lights.setLamps(lampPos, 2.1, 0xcfeadc); lights.grade({ fog: 0x050a08, hemi: [0x2c4a44, 0x08100e, 0.4] }); scene.fog.density = 0.05; audio.duck(1, 1.5); instab.set(0.15, 6);
    lights.lamp(0, 'pulse');
    if (R.bend) { R.bend.reset(); if (!R.bend.prepared) R.bend.refresh(); }   // normalmente e' gia' pronto: il ripiego serve solo se qualcosa e' arrivato tardi
  };
  R.leave = () => { R.group.visible = false; if (R.bend) { R.bend.setA(0); R.bend.restoreFov(); } };
  R.update = (dt) => {
    if (!R.group.visible || R.preview) return; R.t += dt; const P = player.pos;
    if (R.bend) { if (R.crossed) { if (R.bend.A) { R.bend.setA(0); R.bend.restoreFov(); } } else R.bend.update(dt, P); }
    { // movimento: corridoio, poi la soglia (varco largo 1,9 m) e infine l'obitorio, senza dissolvenza
      const m = getMorgue(), B = player.box;
      if (B === R.bounds) { if (P.z > zFar + 0.8) { B[0] = -hw + 0.45; B[1] = hw - 0.45; } else if (P.z > zFar - 0.7) { B[0] = -0.8; B[1] = 0.8; } else { B[0] = m.bounds[0]; B[1] = m.bounds[1]; } B[2] = m.bounds[2]; }
      if (!R.crossed && P.z < zFar + 1.5) { R.crossed = true; m.enter(true); story?.seamless('morgue'); camera.far = 34; camera.updateProjectionMatrix(); }
    }
    // sfarfallio a caso di una lampada, ogni tanto
    if (!R.crossed && R.state !== 'beat' && Math.random() < dt * 0.25) lights.lamp(0, 'flicker', 0.3 + Math.random() * 0.4);
    if (R.state === 'walk' && P.z < z0 - 8.5) {   // a meta' corridoio: tutte le luci spente per un secondo; la sedia, nel buio, si avvicina
      R.state = 'beat'; R.bt = 0; lights.lamp(0, 'off'); audio.lightOff?.(); instab.push(0.8, 5);
    }
    if (R.state === 'beat') { R.bt += dt;
      if (R.bt > 0.6 && !R.hit) R.hit = true;   // la sedia a rotelle resta ferma dov'e'
      if (R.bt > 1.2) { R.state = 'after'; lights.lamp(0, 'flicker', 0.9); setTimeout(() => lights.lamp(0, 'pulse'), 1100); audio.lightOn?.(); } }
  };
  return R;
}
