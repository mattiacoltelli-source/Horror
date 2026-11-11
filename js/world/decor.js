// Arredo modulare delle stanze (tubi, cavi, recinzioni, tombini, grondaie). Tutto statico e fuso in pochi mesh.
import { kitMesh, runZ } from './props.js';
const P2 = Math.PI / 2;
const add = async (group, kit, pl) => { try { const m = await kitMesh(kit, pl); if (m) { m.traverse((o) => { o.userData.decor = true; if (globalThis.__lowQ) o.visible = false; }); group.add(m); } } catch (e) { console.warn('decor', kit, e); } };
const manhole = (x, z, rot = 0) => [{ n: 'water_manhole_cover_frame', p: [x, 0.035, z], r: [0, rot, 0] }, { n: 'water_manhole_cover', p: [x, 0.046, z], r: [0, rot, 0] }];
// pezzo di recinzione lungo l'asse z (altezza 2.37): n pannelli da 0.93 + paletti
const fenceZ = (x, z0, z1) => { const out = []; for (let z = z0 - 0.955; z > z1 - 0.5; z -= 1.91) { out.push({ n: 'Plane020', p: [x, 1.19, z], r: [0, P2, 0] }); out.push({ n: 'post', p: [x, 1.26, z + 0.955], r: [0, 0, 0] }); } out.push({ n: 'post', p: [x, 1.26, z0 - 1.91 * Math.ceil((z0 - z1) / 1.91)], r: [0, 0, 0] }); return out; };
const cableRun = (x, y, z0, z1) => [...runZ('cable_straight_long', 0.61, x, y, z0, Math.max(z1, z0 - 1.9)), { n: 'cable_box_turn', p: [x, y, z0 + 0.1], r: [0, 0, 0] }];

export function decorTunnel(group) {
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -1.27, 2.0, 2.4, -54.4));
  add(group, 'pipes', [...runZ('pipe_thin_200cm_metal', 2.0, -1.33, 1.62, 2.4, -54.4).map((p) => ({ ...p, r: [0, P2, 0] }))]);
  add(group, 'cables', [...cableRun(1.38, 2.0, -3, -7), ...cableRun(1.38, 2.0, -28, -31.5), { n: 'cable_lightswitch', p: [1.38, 1.3, -33], r: [0, 0, 0] }]);
  add(group, 'manhole', [...manhole(-0.15, -14.5), ...manhole(0.3, -45, 0.7)]);
}
export function decorHall(group, z0) {
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -5.8, 4.9, z0 - 1, z0 - 38));
  add(group, 'cables', [...cableRun(-5.97, 3.2, z0 - 3, z0 - 6), ...cableRun(5.97, 3.0, z0 - 14, z0 - 17)]);
  add(group, 'manhole', manhole(-2.4, z0 - 9, 0.4).concat(manhole(2.0, z0 - 23, 1.2)));
}
export function decorCellar(group, z0) {
  add(group, 'pipes', [...runZ('pipe_200cm_metal', 2.0, 3.85, 3.6, z0 - 1, z0 - 23), ...runZ('pipe_thin_200cm_metal', 2.0, 3.9, 3.2, z0 - 1, z0 - 23).map((p) => ({ ...p, r: [0, P2, 0] }))]);
  add(group, 'fence', fenceZ(3.25, z0 - 14, z0 - 19));
  add(group, 'cables', cableRun(-3.97, 3.0, z0 - 2, z0 - 5));
  add(group, 'manhole', manhole(-1.0, z0 - 5.5, 0.3));
}
export function decorWarehouse(group, z0) {
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -2.4, 6.2, z0 - 1, z0 - 34));
  add(group, 'fence', [...fenceZ(-4.05, z0 - 3, z0 - 8), ...fenceZ(4.05, z0 - 28.5, z0 - 34)]);
  add(group, 'gutter', runZ('modular_metal_gutter', 1.51, 5.55, 5.4, z0 - 1, z0 - 14).map((p) => ({ ...p, r: [0, P2, 0] })));
  add(group, 'manhole', manhole(0.2, z0 - 10, 0.5).concat(manhole(-1.0, z0 - 30.5, 0)));
  add(group, 'cables', [...cableRun(5.97, 3.1, z0 - 6, z0 - 9), ...cableRun(-5.97, 3.1, z0 - 20, z0 - 23)]);
}
export function decorTower(group, z0) {
  add(group, 'ind', [...runZ('modular_industrial_pipes_01_pipe02', 1.95, -6.8, 6.5, z0 - 1, z0 - 16), ...runZ('modular_industrial_pipes_01_pipe02', 1.95, 6.8, 7.2, z0 - 1, z0 - 16)]);
  add(group, 'pipes', [{ n: 'pipe_valve_large_metal', p: [-6.7, 5.5, z0 - 8], r: [0, 0, 0] }]);
  add(group, 'cables', cableRun(6.97, 3.0, z0 - 3, z0 - 6));
  add(group, 'manhole', manhole(2.2, z0 - 5, 0.9));
}
