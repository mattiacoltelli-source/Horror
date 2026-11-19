// Tunnel a volta in mattoni: geometria procedurale, 1 mesh per materiale (poche draw call).
import * as THREE from 'three';
import { TILES } from './materials.js';

export const W = 1.4;          // semi-larghezza
export const H0 = 2.1;         // altezza dei piedritti
export const Z_START = 3;
export const Z_END = -50;   // accorciato di un segmento (6 m): era -56
export const GLASS = { z0: -21, z1: -24, y0: 0.15, y1: 2.05, x: 1.62 };
export const DOOR = { w: 2.0, h: 2.93 };
export const RIBS = [-2, -8, -14, -19.5, -25.5, -31.5, -38, -44];
export const LAMPS = [-6, -17.5, -33, -41];
// porte laterali del tunnel (evento della piega): a destra l'ingresso, a sinistra l'uscita (chiusa da un tampone di muro finche' non serve)
export const SIDE_DOORS = [{ side: 1, z: -34.5, w: 1.4, h: 2.08, spring: 1.38 }, { side: -1, z: -40.2, w: 1.4, h: 2.08, spring: 1.38 }];

// rng deterministico: stessa geometria a ogni avvio
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export class Builder {
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

export const gray = (v) => [v, v, v];

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

  // pannello con varco: stessi parametri casuali e stesse UV del pannello pieno; il "tampone" (BP) riempie il varco con la stessa texture (si toglie/si mette quando serve)
  const BP = { 1: new Builder(), [-1]: new Builder() };
  function wallPanelDoor(side, z0, z1, d) {   // varco ad arco: rettangolo fino alla linea d'imposta, poi mezzo cerchio di raggio w/2
    const x = side * W, k = 0.62 + rnd() * 0.38, flip = rnd() < 0.5 ? -1 : 1, ou = rnd() * 4, ov = Math.floor(rnd() * 3) * 0.33;
    const U = (z) => (flip * -z) / bu + ou, V = (y) => y / bv + ov, rad = d.w / 2;
    const q = (Bd, za, zb, ya0, yb0, ya1, yb1) => { Bd.quad('brick', [[x, ya0, za], [x, yb0, zb], [x, yb1, zb], [x, ya1, za]], [[U(za), V(ya0)], [U(zb), V(yb0)], [U(zb), V(yb1)], [U(za), V(ya1)]], [wallCol(ya0, k), wallCol(yb0, k), wallCol(yb1, k), wallCol(ya1, k)], [-side, 0, 0]); };
    const a = d.z + rad, b = d.z - rad, top = (z) => d.spring + Math.sqrt(Math.max(0, rad * rad - (z - d.z) * (z - d.z)));
    if (z0 > a) q(B, z0, a, 0, 0, H0, H0); if (b > z1) q(B, b, z1, 0, 0, H0, H0);
    const N = 16; for (let i = 0; i < N; i++) { const za = a - (2 * rad * i) / N, zb = a - (2 * rad * (i + 1)) / N; q(B, za, zb, top(za), top(zb), H0, H0); q(BP[side], za, zb, 0, 0, top(za), top(zb)); }
  }
  const doorAt = (side, z, z1) => SIDE_DOORS.find((d) => d.side === side && d.z < z && d.z > z1);
  // MURI
  for (let z = Z_START; z > Z_END; z -= 3) {
    const z1 = Math.max(z - 3, Z_END);
    { const d = doorAt(-1, z, z1); if (d) wallPanelDoor(-1, z, z1, d); else wallPanel(-1, z, z1, 0, H0); }
    { const d = doorAt(1, z, z1); if (d) { wallPanelDoor(1, z, z1, d); continue; } }
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

  // Costoloni: UV continue sulla faccia, piccoli smussi e pietra consumata.
  // Tutto resta nello stesso batch 'stone', senza nuove draw call.
  const [su, sv] = TILES.stone;
  const D = 0.22, T = 0.5, bevel = 0.007;
  for (const zc of RIBS) {
    const za = zc + T / 2, zb = zc - T / 2, Ri = R - D;
    const noise = (n) => { const v = Math.sin((zc + n * .73) * 127.1) * 43758.5453; return v - Math.floor(v); };
    const frontUV = (P) => P.map(([x,y]) => [x / su + noise(71) * 3, y / sv + noise(83)]);
    const front = (P, color, normal) => B.quad('stone', P, frontUV(P), P.map(() => color), normal);
    for (const side of [-1,1]) for (let j=0;j<4;j++) {
      const y0=H0*j/4,y1=H0*(j+1)/4,wear=j===3?0:noise(j+side*11)*.004;
      const xi=side*(Ri+wear),xo=side*R,c=gray((.69+noise(j+side*17)*.10)*(.80+.20*j/3));
      B.quad('stone',[[xi,y0,za-bevel],[xi,y0,zb+bevel],[xi,y1,zb+bevel],[xi,y1,za-bevel]],
        [[za/su,y0/sv],[zb/su,y0/sv],[zb/su,y1/sv],[za/su,y1/sv]],[c,c,c,c],[-side,0,0]);
      for(const [zz,nz]of [[za,1],[zb,-1]]) {
        front([[xi+side*bevel,y0,zz],[xo,y0,zz],[xo,y1,zz],[xi+side*bevel,y1,zz]],c,[0,0,nz]);
        front([[xi,y0,zz-nz*bevel],[xi+side*bevel,y0,zz],[xi+side*bevel,y1,zz],[xi,y1,zz-nz*bevel]],gray(c[0]*1.04),[-side*.7,0,nz*.7]);
        if(j>0) front([[xi+side*bevel,y0,zz+nz*.0005],[xo,y0,zz+nz*.0005],[xo,y0+.0035,zz+nz*.0005],[xi+side*bevel,y0+.0035,zz+nz*.0005]],gray(.30),[0,0,nz]);
      }
    }
    // Una scheggiatura riduce la pietra verso il muro; non restringe il passaggio.
    const radius = (i) => Ri + (i===0||i===SEG?0:noise(i+31)>.76?.004+noise(i+41)*.007:noise(i+51)*.0015);
    for (let i=0;i<SEG;i++) {
      const a0=Math.PI-i/SEG*Math.PI,a1=Math.PI-(i+1)/SEG*Math.PI;
      const point=(a,r)=>[r*Math.cos(a),H0+r*Math.sin(a)];
      const [x0,y0]=point(a0,radius(i)),[x1,y1]=point(a1,radius(i+1));
      const [bx0,by0]=point(a0,radius(i)+bevel),[bx1,by1]=point(a1,radius(i+1)+bevel);
      const [ox0,oy0]=point(a0,R),[ox1,oy1]=point(a1,R);
      const normal=(a)=>[-Math.cos(a),-Math.sin(a),0],c=gray(.70+noise(i+111)*.10);
      const s0=(H0+i/SEG*Math.PI*Ri)/sv,s1=(H0+(i+1)/SEG*Math.PI*Ri)/sv;
      B.quad('stone',[[x0,y0,za-bevel],[x1,y1,za-bevel],[x1,y1,zb+bevel],[x0,y0,zb+bevel]],
        [[za/su,s0],[za/su,s1],[zb/su,s1],[zb/su,s0]],[c,c,c,c],[normal(a0),normal(a1),normal(a1),normal(a0)]);
      for(const [zz,nz]of [[za,1],[zb,-1]]) {
        front([[bx0,by0,zz],[ox0,oy0,zz],[ox1,oy1,zz],[bx1,by1,zz]],c,[0,0,nz]);
        const mid=normal((a0+a1)/2);
        front([[x0,y0,zz-nz*bevel],[bx0,by0,zz],[bx1,by1,zz],[x1,y1,zz-nz*bevel]],gray(c[0]*1.04),[mid[0]*.7,mid[1]*.7,nz*.7]);
        if(i>0){const angle=a0-(.0025+noise(i+141)*.0015)/Ri,inner=point(angle,radius(i)+bevel),outer=point(angle,R);
          front([[bx0,by0,zz+nz*.0005],[ox0,oy0,zz+nz*.0005],[outer[0],outer[1],zz+nz*.0005],[inner[0],inner[1],zz+nz*.0005]],gray(.31),[0,0,nz]);}
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

  // pavimento della stanza buia oltre il portone (si vede solo con la torcia)
  {
    const [fu, fv] = TILES.floorB, c = gray(0.35), x = 1.0;
    B.quad('floorB', [[-x, 0, Z_END], [x, 0, Z_END], [x, 0, Z_END - 6], [-x, 0, Z_END - 6]],
      [[-x / fu, -Z_END / fv], [x / fu, -Z_END / fv], [x / fu, (-Z_END + 6) / fv], [-x / fu, (-Z_END + 6) / fv]], [c, c, c, c], [0, 1, 0]);
  }

  // Pareti di testa: strisce verticali che seguono la volta; in fondo c'è il vano del portone (vuoto nero dietro)
  const topAt = (x) => H0 + Math.sqrt(Math.max(0, R * R - x * x));
  const N = 28;
  for (const [zz, nz] of [[Z_END, 1], [Z_START, -1]]) {
    for (let i = 0; i < N; i++) {
      const x0 = -W + (2 * W * i) / N, x1 = -W + (2 * W * (i + 1)) / N;
      const inDoor = zz === Z_END && Math.abs((x0 + x1) / 2) < DOOR.w / 2;
      // il vano segue la curva ad arco del portone (sopra restano mattoni)
      const dt = (x) => (inDoor ? DOOR.h - 0.38 + 0.38 * Math.sqrt(Math.max(0, 1 - (x / (DOOR.w / 2)) ** 2)) : 0);
      const yb0 = dt(x0), yb1 = dt(x1), yb = Math.min(yb0, yb1);
      const t0 = Math.max(yb0, topAt(x0)), t1 = Math.max(yb1, topAt(x1));
      if (t0 - yb0 < 0.001 && t1 - yb1 < 0.001) continue;
      const k = 0.4 + 0.1 * (i % 3);
      B.quad('brick', [[x0, yb0, zz], [x1, yb1, zz], [x1, t1, zz], [x0, t0, zz]],
        [[x0 / bu + 0.3, yb0 / bv], [x1 / bu + 0.3, yb1 / bv], [x1 / bu + 0.3, t1 / bv], [x0 / bu + 0.3, t0 / bv]],
        [gray(k), gray(k), gray(k * 1.1), gray(k * 1.1)], [0, 0, nz]);
    }
  }
  // spalle del vano (profondità 0.35)
  for (const s2 of [-1, 1]) {
    const x = s2 * DOOR.w / 2;
    B.quad('brick', [[x, 0, Z_END], [x, 0, Z_END - 0.35], [x, DOOR.h, Z_END - 0.35], [x, DOOR.h, Z_END]],
      [[0, 0], [0.35 / bu, 0], [0.35 / bu, DOOR.h / bv], [0, DOOR.h / bv]], [gray(.2), gray(.2), gray(.2), gray(.2)], [-s2, 0, 0]);
  }

  const g = B.build(mats);
  g.userData.plugs = {};
  for (const side of [1, -1]) { const pg = BP[side].build(mats); pg.visible = side === -1; g.add(pg); g.userData.plugs[side] = pg; }   // tamponi dei varchi: sinistro presente (porta non ancora comparsa), destro nascosto
  return g;
}
