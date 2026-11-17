// Stanze rettangolari procedurali (pavimento, soffitto, muri a pannelli, pilastri, vano porta opzionale).
// Stessa tecnica del tunnel: 1 mesh per materiale, UV in metri, colore vertice per umidità e variazione.
import * as THREE from 'three';
import { Builder, gray } from './tunnel.js';
import { TILES } from './materials.js';

export function buildRoom(mats, o) {
  const { cx = 0, z0, w, l, h, wall = 'brick', floor = 'floorA', ceil = 'brick', pillarEvery = 0, door = null, dark = 1, seed = 7 } = o;
  let sd = seed; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const B = new Builder(), xl = cx - w / 2, xr = cx + w / 2, z1 = z0 - l;
  const [wu, wv] = TILES[wall], [fu, fv] = TILES[floor], [cu, cv] = TILES[ceil];
  const col = (y, k) => gray(k * dark * (0.5 + 0.5 * Math.min(1, y / (h * 0.55))));

  // pavimento e soffitto a pannelli
  for (let x = xl; x < xr - 0.01; x += 4) for (let z = z0; z > z1 + 0.01; z -= 4) {
    const xe = Math.min(x + 4, xr), ze = Math.max(z - 4, z1), ou = rnd() * 3, ov = rnd() * 3, k = 0.38 + rnd() * 0.12;
    B.quad(floor, [[x, 0, z], [xe, 0, z], [xe, 0, ze], [x, 0, ze]],
      [[x / fu + ou, -z / fv + ov], [xe / fu + ou, -z / fv + ov], [xe / fu + ou, -ze / fv + ov], [x / fu + ou, -ze / fv + ov]], [gray(k * dark), gray(k * dark), gray(k * dark), gray(k * dark)], [0, 1, 0]);
    B.quad(ceil, [[x, h, z], [xe, h, z], [xe, h, ze], [x, h, ze]],
      [[x / cu, -z / cv], [xe / cu, -z / cv], [xe / cu, -ze / cv], [x / cu, -ze / cv]], [gray(.22 * dark), gray(.22 * dark), gray(.22 * dark), gray(.22 * dark)], [0, -1, 0]);
  }
  // muri laterali
  // sideDoor / sideDoors: { side: 1 (destro) | -1 (sinistro), z, w, h }.
  // panel: nome facoltativo della faccia da restituire separata, per una porta nascosta.
  // reflectionPanel: stessa faccia solo per lo specchio, senza cambiare i colori del muro reale.
  const panels = {};
  const wallQ = (x, nx) => { const holes = (o.sideDoors || (o.sideDoor ? [o.sideDoor] : []))
      .filter((d) => d.side === -nx).sort((a, b) => b.z - a.z);
    for (let z = z0; z > z1 + 0.01; z -= 4) {
      const ze = Math.max(z - 4, z1), k = 0.6 + rnd() * 0.4, fl = rnd() < 0.5 ? -1 : 1, ou = rnd() * 4;
      const U = (zz) => (fl * -zz) / wu + ou;
      const matching = holes.filter((d) => d.z + d.w / 2 > ze && d.z - d.w / 2 < z);
      const hasPanel = matching.some((d) => d.panel);
      const shade = (y) => hasPanel ? gray(k * dark * (0.5 + 0.5 * y / h)) : col(y, k);
      const seg = (za, zb, ya, yb, target = B) => { if (za <= zb || yb <= ya) return; target.quad(wall, [[x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za]], [[U(za), ya / wv], [U(zb), ya / wv], [U(zb), yb / wv], [U(za), yb / wv]], [shade(ya), shade(ya), shade(yb), shade(yb)], [nx, 0, 0]); };
      let cursor = z;
      for (const hole of matching) {
        const ha = Math.min(hole.z + hole.w / 2, z), hb = Math.max(hole.z - hole.w / 2, ze);
        if (ha <= hb) continue;
        seg(cursor, ha, 0, h); seg(ha, hb, hole.h, h);
        // Un pannello segreto conserva UV e colori esatti del muro originale.
        const panelName = hole.panel || hole.reflectionPanel;
        if (panelName) seg(ha, hb, 0, hole.h, panels[panelName] ??= new Builder());
        cursor = hb;
      }
      seg(cursor, ze, 0, h);
    } };
  wallQ(xl, 1); wallQ(xr, -1);
  // pareti di testa (la prima con il vano porta)
  const endWall = (z, nz, opening) => { for (let x = xl; x < xr - 0.01; x += 1) {   // pannelli da 1 m: il vano porta (2 m) resta esatto
    const xe = Math.min(x + 1, xr), k = 0.5 + rnd() * 0.3, U = (xx) => xx / wu + 0.3;
    const seg = (a, b, y) => { if (b <= a) return; B.quad(wall, [[a, y, z], [b, y, z], [b, h, z], [a, h, z]], [[U(a), y / wv], [U(b), y / wv], [U(b), h / wv], [U(a), h / wv]], [col(y, k), col(y, k), col(h, k), col(h, k)], [0, 0, nz]); };
    const left = cx - (opening?.w || 0) / 2, right = cx + (opening?.w || 0) / 2;
    if (opening && xe > left && x < right) { seg(x, Math.max(x, left), 0); seg(Math.max(x, left), Math.min(xe, right), opening.h); seg(Math.min(xe, right), xe, 0); }
    else seg(x, xe, 0);
  } };
  endWall(z0, -1, door); if (!o.openEnd) endWall(z1, 1, o.exit || null);   // exit: varco d'uscita in fondo   // openEnd: niente parete di fondo (si continua in un'altra stanza)
  // pilastri in pietra lungo i muri
  const pillars = [];
  if (pillarEvery) for (let z = z0 - pillarEvery * 0.6; z > z1 + 1; z -= pillarEvery) for (const sx of [-1, 1]) {
    const x = cx + sx * (w / 2 - 0.5), r = 0.45; pillars.push([x, z]);
    const quad = (P, UVs, N) => B.quad('stone', P, UVs, [gray(.45 * dark), gray(.45 * dark), gray(.45 * dark), gray(.45 * dark)], N);
    for (const [ax, az, bx, bz, nx, nz] of [[x - r, z + r, x + r, z + r, 0, 1], [x + r, z + r, x + r, z - r, 1, 0], [x + r, z - r, x - r, z - r, 0, -1], [x - r, z - r, x - r, z + r, -1, 0]])
      quad([[ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az]], [[0, 0], [1, 0], [1, h / 1.8], [0, h / 1.8]], [nx, 0, nz]);
  }
  const group = B.build(mats);
  const sidePanels = Object.fromEntries(Object.entries(panels).map(([key, b]) => [key, b.build(mats)]));
  return { group, bounds: [xl + 0.5, xr - 0.5, z1 + 0.6, z0 - 0.4], pillars, sidePanels };
}
