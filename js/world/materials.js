// Materiali PBR dai set di texture in assets/tex (color sRGB, normal GL, ORM = AO/Rough/Metal).
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let aniso = 4;
export function setAnisotropy(n) { aniso = n; }

function tex(url, srgb) {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// tile = dimensioni in metri di una ripetizione della texture (U, V)
export const TILES = {
  brick: [2.1, 1.05],
  stone: [1.8, 1.8],
  floorA: [1.6, 1.6],
  floorB: [1.6, 1.6],
  rust: [1.2, 1.2],
};

export function makeMaterials(base = 'assets/tex/') {
  const m = {};
  const set = (name, opts = {}) => {
    const mat = new THREE.MeshStandardMaterial({
      map: tex(`${base}${name}_c.jpg`, true),
      normalMap: tex(`${base}${name}_n.jpg`, false),
      roughnessMap: tex(`${base}${name}_orm.jpg`, false),
      aoMap: opts.noAO ? null : tex(`${base}${name}_orm.jpg`, false),
      metalnessMap: opts.metal ? tex(`${base}${name}_orm.jpg`, false) : null,
      roughness: opts.wet ?? 1,
      metalness: opts.metal ? 1 : 0,
      vertexColors: true,
      color: opts.tint ?? 0xffffff,
    });
    mat.normalScale.set(opts.nrm ?? 1.1, opts.nrm ?? 1.1);
    return mat;
  };
  m.brick = set('brick', { tint: 0xb9b2aa });
  m.stone = set('stone', { tint: 0x8c867f, nrm: 1.6 });
  m.floorA = set('floorA', { tint: 0xc0bcb4, nrm: 1.3, wet: 0.72 });
  m.floorB = set('floorB', { tint: 0xb8b2a8, nrm: 1.3, wet: 0.72 });
  m.rust = set('rust', { metal: true, noAO: true, tint: 0xd0c8c0, nrm: 1.0 });
  return m;
}
