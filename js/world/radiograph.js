// Pellicola radiografica rovinata su un negatoscopio ospedaliero da 50 x 60 cm.
// Il pannello e' appena luminoso: si riconosce l'immagine, senza leggere testo.
import * as THREE from 'three';

export function createRadiograph(group, mats, { x, y, z }) {
  const G = new THREE.Group(); G.name = 'radiografia-obitorio-elisa';
  G.position.set(x, y, z); G.rotation.y = -Math.PI / 2; group.add(G);
  const frame = mats.rust.clone(); frame.vertexColors = false; frame.color.setHex(0x667064); frame.roughness = 1; frame.metalness = 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.045), frame); body.name = 'pannello-radiografia-elisa'; G.add(body);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.446, 0.526), new THREE.MeshStandardMaterial({ color: 0x58645b, emissive: 0x9ea79a, emissiveIntensity: 0.06, roughness: 1 }));
  glass.position.z = 0.0235; G.add(glass);
  const map = new THREE.TextureLoader().load('assets/tex/xray_elisa.webp'); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const film = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.43), new THREE.MeshStandardMaterial({ map, color: new THREE.Color(0.65, 0.69, 0.65), emissiveMap: map, emissive: 0xacc0b8, emissiveIntensity: 0.11, roughness: 1, transparent: true, alphaTest: 0.1 }));
  film.name = 'pellicola-radiografia-elisa'; film.position.z = 0.026; film.rotation.z = -0.015; G.add(film);
  const metal = new THREE.MeshStandardMaterial({ color: 0x302d25, metalness: 0.35, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.038, 0.012), metal);
    clip.position.set(side * 0.15, 0.207, 0.033); G.add(clip);
  }
  const switchButton = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.022, 0.009), metal);
  switchButton.position.set(0.2, -0.28, 0.026); G.add(switchButton);
  return G;
}
