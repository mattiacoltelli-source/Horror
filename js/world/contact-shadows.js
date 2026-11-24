// Ombre di contatto statiche: un solo piccolo atlante e una mesh per gruppo.
// Seguono le coordinate del gruppo anche durante i passaggi tra le stanze.
import * as THREE from 'three';
const batches = new WeakMap(); let texture, material;
function shadowMaterial() {
  if (material) return material;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gradient = g.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(0,0,0,.85)'); gradient.addColorStop(.35, 'rgba(0,0,0,.58)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64); texture = new THREE.CanvasTexture(c);
  material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return material;
}
export function addContactShadow(parent, { x = 0, y = 0, z = 0, w, d, angle = 0, strength = .26 }) {
  let batch = batches.get(parent);
  if (!batch) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), shadowMaterial()); mesh.name = 'ombre-di-contatto';
    mesh.userData.contactShadow = true;
    mesh.onBeforeRender = (renderer, scene, camera) => { mesh.material.opacity = camera.userData.planarReflection ? 0 : 1; };
    parent.add(mesh); batch = { mesh, p: [], uv: [], c: [] }; batches.set(parent, batch);
  }
  const cs = Math.cos(angle), sn = Math.sin(angle), corners = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  for (const i of [0,2,1,0,3,2]) {
    const [u,v] = corners[i], px = u*w, pz = v*d;
    batch.p.push(x+px*cs-pz*sn, y+.0018, z+px*sn+pz*cs); batch.uv.push(u+.5,v+.5); batch.c.push(1,1,1,strength);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.p,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2)); geo.setAttribute('color',new THREE.Float32BufferAttribute(batch.c,4)); geo.computeBoundingSphere();
  batch.mesh.geometry.dispose(); batch.mesh.geometry = geo;
  return batch.mesh;
}

// Measure a loaded prop in its shadow parent's coordinates once. Translated
// room previews and moving furniture then carry the same soft contact patch.
export function addObjectContactShadow(parent,object,{floorParent=parent,floorY=0,strength=.23,scale=.82}={}) {
  object.updateWorldMatrix(true,true);parent.updateWorldMatrix(true,false);
  const inverse=parent.matrixWorld.clone().invert(),bounds=new THREE.Box3(),matrix=new THREE.Matrix4();
  object.traverse(o=>{
    if(!o.isMesh||!o.geometry||o.userData.contactShadow)return;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();matrix.multiplyMatrices(inverse,o.matrixWorld);
    bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));
  });
  if(bounds.isEmpty())return null;
  const c=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  floorParent.updateWorldMatrix(true,false);
  const floor=new THREE.Vector3(0,floorY,0).applyMatrix4(floorParent.matrixWorld).applyMatrix4(inverse);
  const shadow=addContactShadow(parent,{x:c.x,y:floor.y,z:c.z,w:Math.max(.035,size.x*scale),d:Math.max(.035,size.z*scale),strength});
  if(floorParent!==parent)shadow.userData.keepParent=true;
  return shadow;
}
