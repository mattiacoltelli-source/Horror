// Same round industrial pendant as the warehouse. Resize only its suspension,
// keeping the shade's proportions and aligning its bottom with the light beam.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
export function addRoundLamps(group, positions, ceiling) {
  const fixtures = positions.map(([x, y, z]) => {
    const fixture = new THREE.Group(); fixture.position.set(x, y, z);
    fixture.name = 'round-industrial-pendant'; group.add(fixture); return fixture;
  });
  new GLTFLoader().load('assets/models/hlamp.glb', ({ scene }) => {
    const bounds = new THREE.Box3().setFromObject(scene), center = bounds.getCenter(new THREE.Vector3());
    const height = bounds.max.y - bounds.min.y, shadeHeight = 0.4;
    fixtures.forEach((fixture) => {
      const model = scene.clone(true), glow = [];
      const suspension = ceiling - fixture.position.y - shadeHeight;
      model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.geometry = mesh.geometry.clone(); const vertices = mesh.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
          const y = vertices.getY(i) - bounds.min.y;
          vertices.setXYZ(i, vertices.getX(i) - center.x,
            y <= shadeHeight ? y : shadeHeight + (y - shadeHeight) / (height - shadeHeight) * suspension,
            vertices.getZ(i) - center.z);
        }
        vertices.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => {
          const copy = material.clone();
          if (copy.emissiveMap) { glow.push([copy, copy.emissiveIntensity]); }
          return copy;
        });
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      });
      fixture.userData.setGlow = (level) => glow.forEach(([material, intensity]) => { material.emissiveIntensity = intensity * level; });
      fixture.add(model);
    });
  }, undefined, (error) => console.warn('round lamp fixtures', error));
  return fixtures;
}
