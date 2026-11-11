// Kit modulari (tubi, cavi, recinzioni, tombini, grondaie): ogni pezzo è un GLB con atlas condiviso.
// I pezzi vengono posizionati per CENTRO del loro ingombro e fusi in 1 mesh (1 draw call per kit e per area).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader(), cache = {};
export function loadKit(name) {
  return cache[name] ??= new Promise((res) => loader.load(`assets/models/kit_${name}.glb`, (g) => {
    const raw = {}; g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {                                          // i pezzi multi-materiale arrivano come Nome, Nome_1...
      if (!o.isMesh) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
      const base = o.name.replace(/_(\d)$/, ''); (raw[base] ??= []).push({ geo, mat: o.material });
    });
    const pieces = {};
    for (const [base, parts] of Object.entries(raw)) {                // centro dell'intero pezzo (unione dei sotto-mesh)
      const box = new THREE.Box3(); parts.forEach((p) => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
      const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()); parts.forEach((p) => p.geo.translate(-c.x, -c.y, -c.z));
      pieces[base] = { parts, size };
    }
    res(pieces);
  }, undefined, () => res({})));
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
// placements: [{ n: nomePezzo, p:[x,y,z], r:[rx,ry,rz], s:1 }]
export async function kitMesh(kit, placements) {
  const pieces = await loadKit(kit), byMat = new Map();   // chiave = materiale + fetta di 12 m lungo z (così il frustum culling funziona)
  for (const pl of placements) {
    const pc = pieces[pl.n]; if (!pc) continue;
    _e.set(...(pl.r || [0, 0, 0])); _q.setFromEuler(_e); _s.setScalar(pl.s || 1); _p.set(...pl.p); _m.compose(_p, _q, _s);
    for (const part of pc.parts) {
      const g = part.geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.applyMatrix4(_m); const key = part.mat.uuid + ':' + Math.floor(pl.p[2] / 12); if (!byMat.has(key)) byMat.set(key, { mat: part.mat, geos: [] }); byMat.get(key).geos.push(g);
    }
  }
  const grp = new THREE.Group();
  for (const { mat, geos } of byMat.values()) { if (mat.transparent) { mat.side = THREE.DoubleSide; mat.depthWrite = false; } const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.matrixAutoUpdate = false; m.geometry.computeBoundingSphere(); grp.add(m); }
  return grp.children.length ? grp : null;
}
// lunghezza di un pezzo lungo il suo asse maggiore
export const lenOf = async (kit, n) => { const pc = (await loadKit(kit))[n]; return pc ? Math.max(pc.size.x, pc.size.y, pc.size.z) : 1; };
// serie di pezzi uguali allineati lungo z (rotX=π/2 porta l'asse Y del pezzo su z)
export const runZ = (n, len, x, y, z0, z1, extra = {}) => { const out = []; for (let z = z0 - len / 2; z > z1 - 0.01; z -= len) out.push({ n, p: [x, y, z], r: [Math.PI / 2, 0, 0], ...extra }); return out; };
export const runX = (n, len, z, y, x0, x1, extra = {}) => { const out = []; for (let x = x0 + len / 2; x < x1 + 0.01; x += len) out.push({ n, p: [x, y, z], r: [0, 0, Math.PI / 2], ...extra }); return out; };

// pezzo singolo come oggetto animabile (non fuso): { mesh... } centrato sul proprio ingombro
export async function kitObject(kit, name) {
  const pc = (await loadKit(kit))[name]; if (!pc) return null; const g = new THREE.Group();
  for (const p of pc.parts) { if (p.mat.transparent) { p.mat.side = THREE.DoubleSide; p.mat.depthWrite = false; } g.add(new THREE.Mesh(p.geo, p.mat)); }
  g.userData.size = pc.size; return g;
}
