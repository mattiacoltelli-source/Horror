// Tunnel a volta in mattoni: geometria procedurale, 1 mesh per materiale (poche draw call).
import * as THREE from 'three';
import { TILES } from './materials.js';

export const W = 1.4;          // semi-larghezza
export const H0 = 2.1;         // altezza dei piedritti
export const Z_START = 3;
export const Z_END = -56;
export const GLASS = { z0: -21, z1: -24, y0: 0.15, y1: 2.05, x: 1.62 };
export const RIBS = [-2, -8, -14, -19.5, -25.5, -31.5, -38, -44, -50];
export const LAMPS = [-6, -17.5, -33, -47];

// rng deterministico: stessa geometria a ogni avvio
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

class Builder {
  constructor() { this.m = {}; }
  bucket(k) { return this.m[k] ??= { p: [], n: [], u: [], c: [] }; }
  // quad con normale desiderata n (corregge il verso di avvolgimento)
  quad(key, P, UV, C, N) {
    const b = this.bucket(key);
    const A = new THREE.Vector3(...P[0]), B = new THREE.Vector3(...P[1]), Cc = new THREE.Vector3(...P[2]);
    const fn = B.clone().sub(A).cross(Cc.clone().sub(A));
    const want = Array.isArray(N[0]) ? new THREE.Vector3(...N[0]) : new THREE.Vector3(...N);
    const idx = fn.dot(want) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of idx) {
      b.p.push(...P[i]);
      const nn = Array.isArray(N[0]) ? N[i] : N;
      b.n.push(...nn);
      b.u.push(...UV[i]);
      b.c.push(...C[i]);
    }
  }
  build(mats) {
    const g = new THREE.Group();
    for (const [k, d] of Object.entries(this.m)) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(d.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[k]);
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
    }
    return g;
  }
}

const gray = (v) => [v, v, v];

export function buildTunnel(mats) {
  seed = 1337;
  const B = new Builder();
  const [bu, bv] = TILES.brick;

  // colore vertice: umidità (più scuro in basso e sotto la volta) + variazione per pannello
  const wallCol = (y, k) => {
    const damp = 0.55 + 0.45 * Math.min(1, y / 1.4);
    const top = y > 2.9 ? 0.75 : 1;
    return gray(k * damp * top);
  };

  // pannello di muro verticale su x = ±W
  function wallPanel(side, z0, z1, y0, y1, key = 'brick') {
    const x = side * W;
    const k = 0.62 + rnd() * 0.38;
    const flip = rnd() < 0.5 ? -1 : 1;
    const ou = rnd() * 4, ov = Math.floor(rnd() * 3) * 0.33;
    const U = (z) => (flip * -z) / bu + ou;
    const V = (y) => y / bv + ov;
    B.quad(key,
      [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]],
      [[U(z0), V(y0)], [U(z1), V(y0)], [U(z1), V(y1)], [U(z0), V(y1)]],
      [wallCol(y0, k), wallCol(y0, k), wallCol(y1, k), wallCol(y1, k)],
      [-side, 0, 0]);
  }

  // PAVIMENTO
  let alt = 0;
  for (let z = Z_START; z > Z_END; z -= 3) {
    const z1 = Math.max(z - 3, Z_END);
    const key = alt++ % 2 ? 'floorB' : 'floorA';
    const [fu, fv] = TILES[key];
    const ou = rnd() * 3, ov = rnd() * 3;
    const edge = 0.5;
    B.quad(key,
      [[-W, 0, z], [W, 0, z], [W, 0, z1], [-W, 0, z1]],
      [[-W / fu + ou, -z / fv + ov], [W / fu + ou, -z / fv + ov], [W / fu + ou, -z1 / fv + ov], [-W / fu + ou, -z1 / fv + ov]],
      [gray(edge), gray(edge), gray(edge), gray(edge)], [0, 1, 0]);
  }

  // MURI
  for (let z = Z_START; z > Z_END; z -= 3) {
    const z1 = Math.max(z - 3, Z_END);
    wallPanel(-1, z, z1, 0, H0);
    if (Math.abs(z - GLASS.z0) < 0.01) {
      // apertura sul muro destro: fascia bassa, architrave, spalle
      wallPanel(1, z, z1, 0, GLASS.y0);
      wallPanel(1, z, z1, GLASS.y1, H0);
    } else wallPanel(1, z, z1, 0, H0);
  }

  // VOLTA (archi lisci), uv continue con i muri
  const SEG = 14, R = W;
  for (let z = Z_START; z > Z_END; z -= 3) {
    const z1 = Math.max(z - 3, Z_END);
    const k = 0.5 + rnd() * 0.3, flip = rnd() < 0.5 ? -1 : 1, ou = rnd() * 4;
    for (let i = 0; i < SEG; i++) {
      const a0 = Math.PI - (i / SEG) * Math.PI, a1 = Math.PI - ((i + 1) / SEG) * Math.PI;
      const p = (a) => [R * Math.cos(a), H0 + R * Math.sin(a)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      const s0 = (H0 + (i / SEG) * Math.PI * R) / bv, s1 = (H0 + ((i + 1) / SEG) * Math.PI * R) / bv;
      const n = (a) => [-Math.cos(a), -Math.sin(a), 0];
      const U = (zz) => (flip * -zz) / bu + ou;
      B.quad('brick',
        [[x0, y0, z], [x1, y1, z], [x1, y1, z1], [x0, y0, z1]],
        [[U(z), s0], [U(z), s1], [U(z1), s1], [U(z1), s0]],
        [gray(k), gray(k), gray(k), gray(k)],
        [n(a0), n(a1), n(a1), n(a0)]);
    }
  }

  // COSTOLONI in pietra (pilastri + arco), con profondità
  const [su, sv] = TILES.stone;
  const D = 0.22, T = 0.5; // sporgenza e spessore
  for (const zc of RIBS) {
    const za = zc + T / 2, zb = zc - T / 2;
    const c = gray(0.8);
    // pilastri
    for (const s of [-1, 1]) {
      const xi = s * (W - D), xo = s * W;
      B.quad('stone', [[xi, 0, za], [xi, 0, zb], [xi, H0, zb], [xi, H0, za]],
        [[0, 0], [T / su, 0], [T / su, H0 / sv], [0, H0 / sv]], [c, c, c, c], [-s, 0, 0]);
      for (const [zz, nz] of [[za, 1], [zb, -1]]) {
        B.quad('stone', [[xi, 0, zz], [xo, 0, zz], [xo, H0, zz], [xi, H0, zz]],
          [[0, 0], [D / su, 0], [D / su, H0 / sv], [0, H0 / sv]], [c, c, c, c], [0, 0, nz]);
      }
    }
    // arco
    const Ri = R - D;
    for (let i = 0; i < SEG; i++) {
      const a0 = Math.PI - (i / SEG) * Math.PI, a1 = Math.PI - ((i + 1) / SEG) * Math.PI;
      const pi = (a) => [Ri * Math.cos(a), H0 + Ri * Math.sin(a)];
      const po = (a) => [R * Math.cos(a), H0 + R * Math.sin(a)];
      const [xi0, yi0] = pi(a0), [xi1, yi1] = pi(a1), [xo0, yo0] = po(a0), [xo1, yo1] = po(a1);
      const n = (a) => [-Math.cos(a), -Math.sin(a), 0];
      const len = (Math.PI / SEG) * Ri / sv;
      B.quad('stone', [[xi0, yi0, za], [xi1, yi1, za], [xi1, yi1, zb], [xi0, yi0, zb]],
        [[0, i * len], [0, (i + 1) * len], [T / su, (i + 1) * len], [T / su, i * len]], [c, c, c, c],
        [n(a0), n(a1), n(a1), n(a0)]);
      for (const [zz, nz] of [[za, 1], [zb, -1]]) {
        B.quad('stone', [[xi0, yi0, zz], [xo0, yo0, zz], [xo1, yo1, zz], [xi1, yi1, zz]],
          [[0, 0], [D / su, 0], [D / su, len], [0, len]], [c, c, c, c], [0, 0, nz]);
      }
    }
  }

  // SPALLE dell'apertura (profondità del muro 0.3 m verso la stanza)
  const dep = GLASS.x - W;
  const sides = [[GLASS.z0, -1], [GLASS.z1, 1]];
  for (const [zz, nz] of sides)
    B.quad('brick', [[W, GLASS.y0, zz], [GLASS.x, GLASS.y0, zz], [GLASS.x, GLASS.y1, zz], [W, GLASS.y1, zz]],
      [[0, GLASS.y0 / bv], [dep / bu, GLASS.y0 / bv], [dep / bu, GLASS.y1 / bv], [0, GLASS.y1 / bv]],
      [gray(.5), gray(.5), gray(.5), gray(.5)], [0, 0, nz]);
  for (const [yy, ny] of [[GLASS.y0, 1], [GLASS.y1, -1]])
    B.quad('brick', [[W, yy, GLASS.z0], [GLASS.x, yy, GLASS.z0], [GLASS.x, yy, GLASS.z1], [W, yy, GLASS.z1]],
      [[0, 0], [dep / bu, 0], [dep / bu, 3 / bv], [0, 3 / bv]], [gray(.5), gray(.5), gray(.5), gray(.5)], [0, ny, 0]);
  // muro sopra l'apertura oltre il piedritto (H0..volta) è gestito dalla volta: l'arco chiude sopra.

  // Parete di fondo e parete d'ingresso
  for (const [zz, nz] of [[Z_END, 1], [Z_START, -1]]) {
    const k = 0.4;
    B.quad(zz === Z_END ? 'rust' : 'brick', [[-W, 0, zz], [W, 0, zz], [W, H0, zz], [-W, H0, zz]],
      [[0, 0], [2 * W / 1.2, 0], [2 * W / 1.2, H0 / 1.2], [0, H0 / 1.2]], [gray(k), gray(k), gray(k), gray(k)], [0, 0, nz]);
    // timpano sopra
    const a = (t) => [R * Math.cos(t), H0 + R * Math.sin(t)];
    for (let i = 0; i < SEG; i++) {
      const [x0, y0] = a(Math.PI - (i / SEG) * Math.PI), [x1, y1] = a(Math.PI - ((i + 1) / SEG) * Math.PI);
      B.quad('brick', [[0, H0, zz], [x0, y0, zz], [x1, y1, zz], [0, H0, zz]].slice(0, 4),
        [[0, 0], [1, 0], [1, 1], [0, 1]], [gray(.3), gray(.3), gray(.3), gray(.3)], [0, 0, nz]);
    }
  }

  // Tubature lungo il muro sinistro (cilindri uniti)
  const g = B.build(mats);
  const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, Z_START - Z_END, 10, 1, true);
  pipeGeo.rotateX(Math.PI / 2);
  const uv = pipeGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * (Z_START - Z_END) / 1.2);
  const col = new Float32Array(pipeGeo.attributes.position.count * 3).fill(0.55);
  pipeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const [x, y] of [[-W + 0.1, 2.35], [-W + 0.12, 2.12]]) {
    const pipe = new THREE.Mesh(pipeGeo, mats.rust);
    pipe.position.set(x, y, (Z_START + Z_END) / 2);
    g.add(pipe);
  }
  return g;
}
