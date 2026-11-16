// Oggetti appesi sopra la parete originale: nessuna modifica al materiale del muro.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';
import { createRadiograph } from './radiograph.js';
import { writingDecals } from './blood.js';

export function createMorgueWall(parent, mats, { x, z }) {
  const G = new THREE.Group(); G.name = 'parete-ossessiva-elisa';
  G.position.set(x, 0, z); G.rotation.y = -Math.PI / 2; parent.add(G);
  const loader = new THREE.TextureLoader();
  const atlas = loader.load('assets/tex/morgue_wall_atlas.webp');
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const paper = new THREE.MeshStandardMaterial({ map: atlas, color: new THREE.Color(0.72, 0.69, 0.62), roughness: 1, transparent: true, alphaTest: 0.12, vertexColors: true, side: THREE.DoubleSide });
  const film = new THREE.MeshStandardMaterial({ map: atlas, color: new THREE.Color(0.67, 0.72, 0.70), roughness: 0.77, transparent: true, alphaTest: 0.12, side: THREE.DoubleSide });
  const tape = new THREE.MeshStandardMaterial({ color: 0x8b7c51, roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x39342a, roughness: 0.92, metalness: 0.38 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x26211b, roughness: 1 });
  const batches = new Map();
  const put = (geo, mat, p, r = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, r)), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m); if (!batches.has(mat)) batches.set(mat, []); batches.get(mat).push(geo);
  };
  const pin = (px, py, pz) => put(new THREE.SphereGeometry(0.006, 7, 5), iron, [px, py, pz]);
  const strip = (px, py, pz, r, w = 0.065) => put(new THREE.BoxGeometry(w, 0.025, 0.0015), tape, [px, py, pz], r);
  const tile = (index, w, h, curl, tint) => {
    const geo = new THREE.PlaneGeometry(w, h, 6, 8), pos = geo.attributes.position, uv = geo.attributes.uv;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      pos.setZ(i, curl * (Math.pow(Math.abs(u - 0.5) * 2, 4) * (0.3 + v * 0.7) + Math.pow(1 - v, 6) * 0.5));
      uv.setXY(i, (index % 4 + u) / 4, (1 - Math.floor(index / 4) + v) / 2);
      if (tint) colors.push(tint, tint * 0.98, tint * 0.92);
    }
    if (tint) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals(); return geo;
  };
  // Disposizioni fisse e irregolari: carte A4, piegate, sovrapposte e fissate con nastro.
  const sheets = [
    [-0.88, 2.10, -0.14, 0.29, 0], [-0.56, 2.28, 0.10, 0.27, 1], [-0.23, 2.14, -0.23, 0.30, 2], [0.12, 2.19, 0.18, 0.25, 3],
    [-1.08, 1.82, 0.24, 0.26, 2], [-0.77, 1.87, -0.10, 0.28, 3], [-0.43, 1.98, 0.14, 0.29, 0], [-0.10, 1.88, -0.18, 0.28, 1], [0.23, 1.91, 0.22, 0.27, 0],
    [-1.00, 1.49, -0.19, 0.27, 1], [-0.67, 1.57, 0.13, 0.30, 0], [-0.31, 1.63, -0.06, 0.28, 2], [0.04, 1.55, 0.19, 0.29, 3], [0.36, 1.64, -0.13, 0.25, 1],
    [-0.91, 1.17, 0.10, 0.28, 3], [-0.57, 1.28, -0.21, 0.27, 1], [-0.24, 1.25, 0.15, 0.30, 0], [0.10, 1.20, -0.12, 0.27, 2],
    [-0.46, 0.99, 0.21, 0.26, 2], [-0.08, 0.97, -0.12, 0.29, 1], [-0.37, 1.53, -0.26, 0.29, 3], [-0.72, 1.82, 0.25, 0.26, 2],
  ];
  sheets.forEach(([sx, sy, sr, sw, index], i) => {
    const px = -0.35 + (sx + 0.35) * 0.88, py = 1.62 + (sy - 1.62) * 0.88;
    const r = sr * 1.2, w = sw * 1.12;
    const h = w * 4 / 3, depth = 0.012 + i * 0.0015;
    put(tile(index, w, h, 0.007 + (i % 3) * 0.003, 0.86 + (i % 4) * 0.035), paper, [px, py, depth], r);
    const dx = -Math.sin(r) * h * 0.36, dy = Math.cos(r) * h * 0.36;
    strip(px + dx, py + dy, depth + 0.014, r + (i % 2 ? 0.24 : -0.25));
    if (i % 4 === 0) pin(px + dx, py + dy - 0.01, depth + 0.018);
  });
  // Il pannello da 50 x 60 cm rimane, circondato da altre pellicole con clip.
  createRadiograph(G, mats, { x: 0.93, y: 2.05, z: 0.033, rotationY: 0 });
  const films = [[1.38, 2.02, 6, -0.03, 0.31], [0.80, 1.50, 5, 0.025, 0.38], [1.23, 1.49, 7, -0.02, 0.38], [0.80, 0.99, 6, -0.04, 0.38], [1.23, 0.99, 4, 0.035, 0.38]];
  films.forEach(([px, py, index, r, w], i) => {
    const h = w * 4 / 3, depth = 0.055 + i * 0.001;
    put(tile(index, w, h, 0.003), film, [px, py, depth], r);
    for (const side of [-1, 1]) {
      put(new THREE.BoxGeometry(0.018, 0.027, 0.009), iron, [px + side * w * 0.30, py + h * 0.37, depth + 0.012], r);
      pin(px + side * w * 0.30, py + h * 0.37 + 0.007, depth + 0.018);
    }
  });
  // Segni opachi e slegati dalla trama: numeri, frasi spezzate, conteggi e scarabocchi.
  const texts = writingDecals(G, [
    { text: '17 17 17', p: [-0.91, 0.77, 0.025], wall: '+z', w: 0.65, maxH: 0.16, rot: -0.04 },
    { text: 'NON È QUI', p: [-0.78, 0.53, 0.025], wall: '+z', w: 0.88, maxH: 0.20, rot: 0.015 },
    { text: 'GLI OCCHI APERTI', p: [0.62, 0.51, 0.025], wall: '+z', w: 1.13, maxH: 0.18, rot: -0.045 },
    { text: '3 / 1 / 3', p: [0.15, 2.55, 0.025], wall: '+z', w: 0.63, maxH: 0.16, rot: 0.06 },
  ]);
  texts.forEach(m => { m.material.color.setHex(0x342a22); m.material.emissive.setHex(0); m.material.roughness = 1; m.name = 'scarabocchio-obitorio'; });
  const stroke = (points, radius = 0.0015, mat = ink) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    put(new THREE.TubeGeometry(curve, Math.max(8, points.length * 7), radius, 4, false), mat, [0, 0, 0]);
  };
  for (let row = 0; row < 2; row++) for (let i = 0; i < 24; i++) {
    const px = -1.44 + i * 0.032, py = 1.04 - row * 0.16;
    stroke([[px, py, 0.022], [px - 0.004, py + 0.05, 0.023], [px + 0.006, py + 0.11, 0.022]], 0.0011);
    if (i % 5 === 4) stroke([[px - 0.14, py + 0.015, 0.024], [px + 0.02, py + 0.09, 0.024]], 0.0012);
  }
  // Una faccina cancellata a spirale, piccola come un disegno fatto a mano.
  for (let turn = 0; turn < 2; turn++) {
    const points = [];
    for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; points.push([0.34 + Math.cos(a) * (0.09 + turn * 0.015), 0.80 + Math.sin(a) * 0.105, 0.025]); }
    stroke(points, 0.0013);
  }
  stroke([[0.29, 0.83, 0.026], [0.31, 0.84, 0.026], [0.32, 0.82, 0.026]]);
  stroke([[0.36, 0.83, 0.026], [0.38, 0.85, 0.026], [0.39, 0.82, 0.026]]);
  stroke([[0.28, 0.76, 0.026], [0.34, 0.79, 0.026], [0.40, 0.75, 0.026]]);
  // Strumenti veri del kit dell'obitorio, appesi a ganci, piu' un tubo a cappio.
  stroke([[-1.40, 2.35, 0.05], [-1.56, 2.13, 0.09], [-1.66, 1.47, 0.11], [-1.53, 1.17, 0.11], [-1.36, 1.36, 0.09], [-1.39, 2.35, 0.05]], 0.009, iron);
  const tools = [['mg_tool1', -1.69, 1.96, 0.29, -0.10], ['mg_tool3', -1.44, 1.88, 0.32, 0.10], ['mg_tool4', -1.19, 2.27, 0.34, -0.12], ['mg_tool3', -1.79, 1.51, 0.29, -0.07], ['mg_tool1', -1.36, 1.34, 0.27, 0.16]];
  const gl = new GLTFLoader(), models = new Map(); G.userData.toolsLoaded = 0;
  tools.forEach(([name, px, py, size, r]) => {
    const hookY = py + size * 0.52; pin(px, hookY, 0.049);
    stroke([[px, hookY + 0.025, 0.038], [px, hookY - 0.006, 0.075], [px, hookY - 0.022, 0.066]], 0.003, iron);
    if (!models.has(name)) models.set(name, new Promise(resolve => gl.load(`assets/models/${name}.glb`, g => resolve(g.scene), undefined, () => resolve(null))));
    models.get(name).then(src => {
      if (!src) return;
      const obj = src.clone(true); obj.rotation.x = -Math.PI / 2; obj.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(obj); const s = box.getSize(new THREE.Vector3()); obj.scale.multiplyScalar(size / Math.max(s.x, s.y, s.z));
      box = new THREE.Box3().setFromObject(obj); const center = box.getCenter(new THREE.Vector3()); obj.position.sub(center);
      obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.53); o.material.roughness = Math.max(0.75, o.material.roughness || 0); } });
      const holder = new THREE.Group(); holder.name = 'strumento-appeso'; holder.position.set(px, py, 0.073); holder.rotation.z = r; holder.add(obj); G.add(holder); G.userData.toolsLoaded++;
    });
  });
  // Testa di bambola: volume curvo, faccia in ceramica e cordino fissato in alto.
  const doll = new THREE.Group(); doll.name = 'testa-bambola-obitorio'; doll.position.set(0.31, 2.48, 0.07); doll.rotation.set(0.02, -0.12, -0.16); G.add(doll);
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x716450, roughness: 1 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), ceramic); skull.scale.set(0.077, 0.098, 0.060); skull.position.z = 0.035; doll.add(skull);
  const faceMap = loader.load('assets/tex/morgue_doll_head.webp'); faceMap.colorSpace = THREE.SRGBColorSpace; faceMap.anisotropy = 4;
  const faceGeo = new THREE.PlaneGeometry(0.205, 0.263, 18, 22), fp = faceGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, 0.035 + 0.065 * Math.sqrt(Math.max(0, 1 - (fp.getX(i) / 0.103) ** 2 - (fp.getY(i) / 0.132) ** 2)));
  faceGeo.computeVertexNormals();
  const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: faceMap, color: new THREE.Color(0.71, 0.67, 0.58), roughness: 1, transparent: true, alphaTest: 0.14, side: THREE.DoubleSide })); doll.add(face);
  pin(0.29, 2.79, 0.047);
  stroke([[0.29, 2.79, 0.05], [0.28, 2.72, 0.07], [0.31, 2.60, 0.12]], 0.0035, iron);
  // Geometrie statiche raggruppate per materiale, per contenere le draw call su telefono.
  for (const [mat, geos] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat); mesh.name = mat === paper ? 'fogli-clinici-sovrapposti' : mat === film ? 'pellicole-appese' : 'dettagli-parete-obitorio'; G.add(mesh);
    geos.forEach(geo => geo.dispose());
  }
  G.userData.sheetCount = sheets.length; G.userData.filmCount = films.length + 1;
  return G;
}
