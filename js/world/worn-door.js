// Crepe discontinue nel giunto: niente cornice rettangolare tracciata col righello.
import * as THREE from 'three';

export function createWornDoorOutline(width, height) {
  const group = new THREE.Group(); group.name = 'giunti-pannello-segreto'; group.visible = false;
  let seed = 4179; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const crack = { p: [], c: [] }, chips = { p: [], c: [] };
  const triangle = (data, points, shade) => { for (const [z, y] of points) { data.p.push(-0.009, y, z); data.c.push(shade, shade * 0.86, shade * 0.67); } };
  const ribbon = (points, thickness = 0.006, gaps = true) => {
    for (let i = 0; i + 1 < points.length; i++) {
      if (gaps && rnd() < 0.09) continue;
      const a = points[i], b = points[i + 1], dz = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dz, dy);
      if (d < 0.0001) continue;
      const wa = thickness * (0.25 + rnd() * 0.9), wb = thickness * (0.25 + rnd() * 0.9), nz = -dy / d, ny = dz / d;
      const A = [a[0] + nz * wa, a[1] + ny * wa], B = [b[0] + nz * wb, b[1] + ny * wb];
      const C = [b[0] - nz * wb, b[1] - ny * wb], D = [a[0] - nz * wa, a[1] - ny * wa];
      const shade = 0.025 + rnd() * 0.055; triangle(crack, [A, B, C], shade); triangle(crack, [A, C, D], shade);
    }
  };
  const scar = ([z, y], side) => {
    const w = 0.009 + rnd() * 0.019, h = 0.009 + rnd() * 0.024, s = 0.16 + rnd() * 0.07;
    const center = [z + side * w * 0.35, y], edge = Array.from({ length: 5 }, (_, i) => {
      const angle = i * Math.PI * 0.4, k = 0.6 + rnd() * 0.4;
      return [center[0] + Math.cos(angle) * w * k, y + Math.sin(angle) * h * k];
    });
    for (let i = 0; i < edge.length; i++) for (const [point, alpha] of [[center, 0.55], [edge[i], 0], [edge[(i + 1) % edge.length], 0]]) {
      chips.p.push(-0.009, point[1], point[0]); chips.c.push(s, s * 0.86, s * 0.67, alpha);
    }
  };
  for (const [edge, sign] of [[-0.003, 1], [-width + 0.003, -1]]) {
    const points = [];
    for (let y = 0.02; y < height - 0.012; y += 0.035 + rnd() * 0.018) {
      // Piccoli cambi di direzione e denti nella malta, senza scalini regolari.
      const z = edge + (rnd() - 0.5) * 0.024 + Math.sin(y * 13 + sign) * 0.005;
      points.push([z, y]);
      if (rnd() < 0.13) scar([z, y], sign);
      if (rnd() < 0.07 && y > 0.2 && y < height - 0.2) {
        ribbon([[z, y], [z + sign * 0.025, y + 0.015], [z + sign * (0.045 + rnd() * 0.04), y + 0.009]], 0.002, false);
      }
    }
    ribbon(points, 0.0045);
  }
  const top = [];
  for (let z = -0.02; z > -width + 0.02; z -= 0.035 + rnd() * 0.025) {
    const y = height - 0.007 + (rnd() - 0.5) * 0.02; top.push([z, y]);
    if (rnd() < 0.2) scar([z, y], rnd() > 0.5 ? 1 : -1);
  }
  ribbon(top, 0.004);
  const make = (data, material, name) => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.c, data === chips ? 4 : 3));
    const normals = Array.from({ length: data.p.length / 3 }, () => [-1, 0, 0]).flat(); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; group.add(mesh);
  };
  make(crack, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.46, depthWrite: false, side: THREE.DoubleSide }), 'crepe-irregolari');
  make(chips, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), 'malta-scheggiata');
  return group;
}
