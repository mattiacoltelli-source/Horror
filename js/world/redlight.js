// Luce rossa d'emergenza FINTA ma credibile, senza luci reali (zero costo shader): lampadina in gabbia + alone additivo sul muro e sul pavimento.
// Sempre bassa, respira piano, ogni tanto cede o sfarfalla (coerente con le altre lampade del gioco).
import * as THREE from 'three';

let glowTex = null;
const glow = () => {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,40,24,1)'); r.addColorStop(0.25, 'rgba(200,20,12,.55)'); r.addColorStop(0.6, 'rgba(110,8,6,.16)'); r.addColorStop(1, 'rgba(60,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
};

// x,y,z: posizione della lampada sul muro; dir = +1 se il muro è a destra (la luce guarda verso -x), -1 se a sinistra
export function redLight(group, { x, y, z, dir = 1, size = 3.6 }) {
  const R = { level: 1, t: Math.random() * 10, drop: 0, flick: 0 };
  const add = (geo, mat, px, py, pz, ry = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, 0); m.renderOrder = 5; group.add(m); return m; };
  const body = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.7, metalness: 0.6 });
  add(new THREE.BoxGeometry(0.12, 0.2, 0.2), body, x, y, z);                                   // supporto a muro
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff2a18, fog: false });
  const bulb = add(new THREE.SphereGeometry(0.07, 10, 8), bulbMat, x - dir * 0.13, y, z);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.17, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x0b0807, wireframe: true })); cage.position.copy(bulb.position); cage.rotation.z = Math.PI / 2; group.add(cage);
  const add2 = new THREE.MeshBasicMaterial({ map: glow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 });
  const wall = add(new THREE.PlaneGeometry(size, size), add2, x - dir * 0.03, y, z, -dir * Math.PI / 2);          // alone sul muro
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 })); halo.scale.setScalar(0.7); halo.position.copy(bulb.position).addScaledVector(new THREE.Vector3(-dir, 0, 0), 0.1); group.add(halo);
  R.update = (dt) => {
    R.t += dt; let k = 0.62 + 0.18 * Math.sin(R.t * 0.8) + 0.05 * Math.sin(R.t * 5.3);
    if (R.drop > 0) { R.drop -= dt; k *= 0.12 + Math.random() * 0.2; } else if (R.flick > 0) { R.flick -= dt; k *= Math.random() > 0.5 ? 1 : 0.1; }
    else if (Math.random() < dt * 0.12) { if (Math.random() < 0.5) R.drop = 0.1 + Math.random() * 0.35; else R.flick = 0.4 + Math.random() * 0.6; }
    R.level = k; add2.opacity = 0.62 * k; halo.material.opacity = 0.55 * k; bulbMat.color.setRGB(1, 0.16 * k, 0.09 * k).multiplyScalar(0.35 + 0.65 * k);
  };
  return R;
}
