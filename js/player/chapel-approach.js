// Passaggio dalla cantina alla cripta: si arriva ai gradini senza attraversare
// le pareti laterali o salire dentro l'altare. Le coordinate arrivano dalla scena.
export function createChapelApproach({ wallX, altarFrontX, zc, depth, doorWidth = 2, radius = 0.32 }) {
  const maxX = altarFrontX - radius, innerX = wallX + radius;
  const doorHalf = doorWidth / 2 - radius, roomHalf = depth / 2 - radius;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  return (x, z, bounds, old) => {
    // Gli altri percorsi, compreso il santuario dei film, restano al loro controller.
    if (Math.abs(old.z - zc) > depth / 2 + radius) return null;
    if (old.x <= bounds[1] && x <= bounds[1]) return null;
    const valid = (xx, zz) => {
      if (xx <= bounds[1]) return xx >= bounds[0] && zz >= bounds[2] && zz <= bounds[3];
      if (xx > maxX) return false;
      return Math.abs(zz - zc) <= (xx < innerX ? doorHalf : roomHalf);
    };
    let xx = clamp(x, bounds[0], maxX);
    if (!valid(xx, old.z)) xx = old.x;
    const minZ = xx >= innerX ? zc - roomHalf : bounds[2];
    const maxZ = xx >= innerX ? zc + roomHalf : bounds[3];
    let zz = clamp(z, minZ, maxZ);
    if (!valid(xx, zz)) zz = old.z;
    return [xx, zz];
  };
}
