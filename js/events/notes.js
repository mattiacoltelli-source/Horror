// NOTE DA TROVARE (la trama a pezzi): fogli bruciati attaccati ai muri, uno per stanza. Bastano un'occhiata e mezzo secondo per leggerli:
// compare il testo, in corsivo, per qualche secondo. Non c'è nessun contatore: alla fine una riga discreta dice quante ne hai trovate.
// Le note raccontano la storia; chi le trova tutte e 5 ha qualche secondo in più nel combattimento della torre.
import * as THREE from 'three';
import { W as TUNNEL_W } from '../world/tunnel.js';

export const NOTE_TEXT = [
  'paziente n. 17.\ningresso: notte del 3 novembre.\nnon risponde al proprio nome.',
  'ha rotto lo specchio ogni mattina.\nogni mattina lo rimettiamo.\ndice che quella non è la sua faccia.',
  'terapia della sedia: sospesa.\nchiede ogni giorno di sua sorella.\nsorella: deceduta. lui era in casa, quando è bruciata.',
  'incendio partito dal magazzino.\ninnesco volontario. benzina sui registri.\nun solo sopravvissuto: paziente n. 17.',
  'non l\'ho mai lasciato solo.\nl\'ho tirato fuori io, dal fuoco.\nnon lo lascerò nemmeno ora.',
];

let tex = null;
function paperTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 176; const g = c.getContext('2d'); let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#b9ad8c'; g.fillRect(0, 0, 128, 176);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(80,66,44,${0.05 + r() * 0.12})`; g.beginPath(); g.arc(r() * 128, r() * 176, 2 + r() * 12, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(40,32,24,.55)'; g.lineWidth = 1.2; for (let y = 26; y < 150; y += 11) { g.beginPath(); g.moveTo(14, y); for (let x = 14; x < 114 - r() * 26; x += 5) g.lineTo(x, y + (r() - 0.5) * 2.2); g.stroke(); }   // righe scritte a mano
  const edge = g.createRadialGradient(64, 88, 38, 64, 88, 112); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.7, 'rgba(30,18,8,.35)'); edge.addColorStop(1, 'rgba(6,3,2,.92)'); g.fillStyle = edge; g.fillRect(0, 0, 128, 176);   // bordi bruciati
  tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

let glintTex = null;
const glint = () => {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,244,214,1)'); r.addColorStop(0.18, 'rgba(255,236,190,.55)'); r.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  glintTex = new THREE.CanvasTexture(c); glintTex.colorSpace = THREE.SRGBColorSpace; return glintTex;
};

// def: [{ room, parent, p:[x,y,z], ry }] nello stesso ordine di NOTE_TEXT
export function createNotes({ camera, player, audio, story, say, instab, flags, defs }) {
  const N = { found: new Set(), list: [] };
  flags.notes ??= 0;
  const fw = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  defs.forEach((def, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), new THREE.MeshLambertMaterial({ map: paperTexture(), emissive: 0x221a10, emissiveIntensity: 0.35, transparent: false }));
    m.position.set(...def.p); m.rotation.y = def.ry; m.rotation.z = (i - 2) * 0.05; m.userData.note = i; def.parent.add(m);
    // piccolo luccichio sulla carta (un riflesso della torcia): un punto chiaro che pulsa piano ogni ~3 s, visibile da lontano; sparisce quando la nota è letta
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glint(), color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.setScalar(0.17); m.add(sp); sp.position.set(0.06, 0.09, 0.03);   // in alto a destra del foglio, appena davanti
    N.list.push({ i, room: def.room, mesh: m, t: 0, sp, ph: i * 0.77 });
  });
  let clock = 0;
  N.update = (dt) => {
    clock += dt;
    if (story.busy()) return; const cur = story.current(); fw.copy(player.forward).normalize();
    for (const n of N.list) {
      if (n.room !== cur || N.found.has(n.i)) { n.sp.material.opacity = 0; continue; }
      n.mesh.getWorldPosition(p); d.copy(p).sub(camera.position); const dist = d.length(); d.normalize();
      { const ph = ((clock + n.ph) % 3.1) / 3.1, pulse = Math.exp(-(((ph - 0.2) / 0.09) ** 2)); n.sp.material.opacity = dist < 9 ? 0.42 * pulse * Math.min(1, (9 - dist) / 3) : 0; }
      if (dist < 5.5 && d.dot(fw) > 0.9) n.t += dt; else n.t = Math.max(0, n.t - dt * 2);
      if (n.t > 0.35) { N.found.add(n.i); flags.notes = N.found.size; audio.rustle?.(); instab?.push?.(0.25, 3); say(NOTE_TEXT[n.i], 5000, 'note'); }
    }
  };
  return N;
}
