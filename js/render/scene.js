// Le stanze inattive sono radici nascoste della scena. Aggiorna una sola volta
// le radici visibili, inclusi i loro figli nascosti usati dagli effetti/specchi.
// I render annidati riutilizzano queste matrici, con le proprie camere.
export function updateVisibleWorldMatrices(scene) {
  scene.matrixWorldAutoUpdate = false;
  if (scene.matrixAutoUpdate) scene.updateMatrix();
  if (scene.parent) scene.matrixWorld.multiplyMatrices(scene.parent.matrixWorld, scene.matrix);
  else scene.matrixWorld.copy(scene.matrix);
  scene.matrixWorldNeedsUpdate = false;
  for (const child of scene.children) if (child.visible) child.updateMatrixWorld(true);
}

// compile(scene) attraversa anche le stanze nascoste. La vista limitata ai soli
// oggetti visibili evita di compilare l'intero gioco con le luci della stanza
// corrente. Il terzo argomento conserva luci, nebbia e ambiente della scena vera.
export function createScenePreparation(renderer, scene, camera) {
  let pending = null;
  const uploaded = new WeakMap();
  const texture = (t) => {
    if (!t?.isTexture || t.isRenderTargetTexture || t.isCubeTexture || t.isVideoTexture || !t.image || t.image.complete === false) return;
    if (uploaded.get(t) === t.version) return;
    renderer.initTexture(t); uploaded.set(t, t.version);
  };
  return () => {
    if (pending) return pending;
    try {
      const objects = [];
      scene.traverseVisible((o) => {
        if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !camera.layers.test(o.layers)) return;
        objects.push(o);
        for (const mat of [].concat(o.material || [])) {
          for (const value of Object.values(mat)) texture(value);
          if (mat.uniforms) for (const uniform of Object.values(mat.uniforms)) texture(uniform.value);
        }
      });
      // Non riparentare gli oggetti: il sottoinsieme serve solo alla compilazione.
      const subset = { traverse: (visit) => objects.forEach(visit), traverseVisible() {} };
      const compiled = renderer.compileAsync ? renderer.compileAsync(subset, camera, scene) : renderer.compile(subset, camera, scene);
      pending = Promise.resolve(compiled).catch((e) => console.warn('shader preparation', e)).finally(() => { pending = null; });
    } catch (e) { console.warn('shader preparation', e); }
    return pending || Promise.resolve();
  };
}
