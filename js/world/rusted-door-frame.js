// Lamiera sottile a L: il labbro esterno e' quasi a filo dei mattoni; i risvolti
// rivestono lo spessore del vano. Spigoli consumati, senza una cornice massiccia.
import { Builder, gray } from './tunnel.js';

export function createRustedDoorFrame({ width, height, depth = 0.15, lip = 0.007, material, bottom = false }) {
  const B = new Builder(), half = width / 2;
  let seed = 8131; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const quad = (p, n, uv, shade) => B.quad('steel', p, uv.map(([u, v]) => [u / 1.2 + 0.37, v / 1.2 + 0.19]), p.map(() => gray(shade)), n);
  for (const side of [-1, 1]) {
    let y = 0, outer = half + lip, back = -depth;
    while (y < height - 0.0001) {
      const end = Math.min(height, y + 0.065 + rnd() * 0.045);
      const nextOuter = half + lip * (0.65 + rnd() * 0.65), nextBack = -depth + (rnd() - 0.5) * 0.004;
      const inner = side * (half + 0.0005), x0 = side * outer, x1 = side * nextOuter;
      const shade = 0.54 + rnd() * 0.17;
      quad([[inner,y,0.002],[x0,y,0.003],[x1,end,0.003],[inner,end,0.002]], [0,0,1], [[half,y],[outer,y],[nextOuter,end],[half,end]], shade * 0.7);
      quad([[inner,y,0.002],[inner,y,back],[inner,end,nextBack],[inner,end,0.002]], [-side,0,0], [[0,y],[depth,y],[depth,end],[0,end]], shade);
      quad([[x0,y,0.003],[x0,y,-0.001],[x1,end,-0.001],[x1,end,0.003]], [side,0,0], [[0,y],[0.004,y],[0.004,end],[0,end]], shade * 0.65);
      y = end; outer = nextOuter; back = nextBack;
    }
  }
  const horizontal = (y, direction) => {
    let x = -half, outer = y + direction * lip, back = -depth;
    while (x < half - 0.0001) {
      const end = Math.min(half, x + 0.06 + rnd() * 0.05), nextOuter = y + direction * lip * (0.65 + rnd() * 0.65), nextBack = -depth + (rnd() - 0.5) * 0.004;
      const inner = y + direction * 0.0005, shade = 0.56 + rnd() * 0.13;
      quad([[x,inner,0.002],[end,inner,0.002],[end,nextOuter,0.003],[x,outer,0.003]], [0,0,1], [[x,y],[end,y],[end,nextOuter],[x,outer]], shade * 0.7);
      quad([[x,inner,0.002],[x,inner,back],[end,inner,nextBack],[end,inner,0.002]], [0,-direction,0], [[x,0],[x,depth],[end,depth],[end,0]], shade);
      quad([[x,outer,0.003],[end,nextOuter,0.003],[end,nextOuter,-0.001],[x,outer,-0.001]], [0,direction,0], [[x,0],[end,0],[end,0.004],[x,0.004]], shade * 0.65);
      x = end; outer = nextOuter; back = nextBack;
    }
  };
  horizontal(height, 1); if (bottom) horizontal(0, -1);
  const steel = material.clone(); steel.vertexColors = true; steel.color.setHex(0x9a8065);
  steel.roughness = 0.95; steel.metalness = 0.5; steel.normalScale.multiplyScalar(0.8);
  const group = B.build({ steel }); group.userData.lipWidth = lip; group.userData.revealDepth = depth;
  return group;
}
