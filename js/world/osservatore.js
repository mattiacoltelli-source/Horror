import * as THREE from 'three';

/**
 * Modello 3D procedurale de "L'Osservatore Silenzioso" per Non girarti
 */
export function createOsservatoreMonster() {
  const monsterGroup = new THREE.Group();
  monsterGroup.name = 'OsservatoreSilenzioso';

  // 1. Texture procedurale della pelle (grigio-cenere con venature)
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 512;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext('2d');

  ctx.fillStyle = '#6c7075';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 3.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(35, 38, 42, 0.12)' : 'rgba(145, 150, 155, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(28, 22, 32, 0.32)';
  for (let v = 0; v < 45; v++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.4;
    ctx.beginPath();
    let vx = Math.random() * 512;
    let vy = Math.random() * 512;
    ctx.moveTo(vx, vy);
    for (let step = 0; step < 12; step++) {
      vx += (Math.random() - 0.5) * 45;
      vy += (Math.random() - 0.3) * 45;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  const skinTexture = new THREE.CanvasTexture(texCanvas);
  skinTexture.wrapS = THREE.RepeatWrapping;
  skinTexture.wrapT = THREE.RepeatWrapping;

  const skinMaterial = new THREE.MeshStandardMaterial({
    map: skinTexture,
    bumpMap: skinTexture,
    bumpScale: 0.018,
    roughnessMap: skinTexture,
    roughness: 0.52,
    metalness: 0.04,
  });

  // Helper geometrico per deformare le parti del corpo
  function createOrganicPart(rx, ry, rz, segs, rings, deformType) {
    const geo = new THREE.SphereGeometry(1, segs, rings);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let mod = 1.0;

      if (deformType === 'head') {
        if (v.z > 0.35 && v.y > -0.05 && v.y < 0.35 && Math.abs(v.x) > 0.15 && Math.abs(v.x) < 0.58) {
          const dist = Math.hypot(Math.abs(v.x) - 0.34, v.y - 0.14);
          mod -= 0.34 * Math.exp(-dist * dist * 22);
        }
        if (v.y < 0) {
          v.x *= (1.0 + v.y * 0.32);
          v.z *= (1.0 + v.y * 0.22);
        }
      } else if (deformType === 'torso') {
        if (v.y > -0.25 && v.y < 0.65 && v.z > -0.25) {
          mod += Math.sin(v.y * 36.0) * 0.048;
        }
        if (v.y < 0.1) {
          mod -= 0.22 * Math.exp(-Math.pow(v.y + 0.3, 2) * 7);
        }
      }

      v.x *= rx * mod;
      v.y *= ry * mod;
      v.z *= rz * mod;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, skinMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // 2. Assemblaggio anatomia
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.44, 0.02);

  const neck = createOrganicPart(0.046, 0.17, 0.05, 24, 18, 'limb');
  neck.position.set(0.02, 0.12, 0.01);
  neck.rotation.set(0.14, 0, -0.22);
  headPivot.add(neck);

  const head = createOrganicPart(0.13, 0.195, 0.15, 40, 32, 'head');
  head.position.set(0.06, 0.36, 0.06);
  head.rotation.set(0.18, 0.05, -0.38);
  headPivot.add(head);

  monsterGroup.add(headPivot);

  const torso = createOrganicPart(0.19, 0.35, 0.11, 36, 28, 'torso');
  torso.position.set(0, 1.12, 0);
  torso.rotation.set(0.07, 0, 0.03);
  monsterGroup.add(torso);

  const pelvis = createOrganicPart(0.14, 0.12, 0.09, 24, 18, 'limb');
  pelvis.position.set(0, 0.74, -0.01);
  monsterGroup.add(pelvis);

  // Braccia e dita
  [-1, 1].forEach((side) => {
    const upperArm = createOrganicPart(0.035, 0.27, 0.035, 20, 16, 'limb');
    upperArm.position.set(side * 0.23, 1.15, 0.02);
    upperArm.rotation.set(-0.06, 0, -side * 0.15);
    monsterGroup.add(upperArm);

    const foreArm = createOrganicPart(0.026, 0.29, 0.026, 20, 16, 'limb');
    foreArm.position.set(side * 0.29, 0.66, 0.07);
    foreArm.rotation.set(-0.18, 0, -side * 0.08);
    monsterGroup.add(foreArm);

    const hand = createOrganicPart(0.024, 0.06, 0.014, 14, 12, 'limb');
    hand.position.set(side * 0.31, 0.35, 0.12);
    hand.rotation.set(-0.18, 0, -side * 0.05);
    monsterGroup.add(hand);

    for (let f = 0; f < 4; f++) {
      const finger = createOrganicPart(0.0045, 0.075, 0.0045, 10, 8, 'limb');
      finger.position.set(side * 0.31 + (f - 1.5) * 0.011, 0.23, 0.135);
      finger.rotation.set(-0.12, 0, (f - 1.5) * 0.045);
      monsterGroup.add(finger);
    }
  });

  // Gambe
  [-1, 1].forEach((side) => {
    const thigh = createOrganicPart(0.048, 0.27, 0.048, 20, 16, 'limb');
    thigh.position.set(side * 0.09, 0.42, 0);
    thigh.rotation.z = -side * 0.03;
    monsterGroup.add(thigh);

    const calf = createOrganicPart(0.035, 0.25, 0.035, 20, 16, 'limb');
    calf.position.set(side * 0.10, 0.01, -0.02);
    monsterGroup.add(calf);
  });

  // 3. Animazione (respiro + tic della testa)
  monsterGroup.userData.update = (elapsedTime) => {
    const breath = Math.sin(elapsedTime * 2.3) * 0.018 + Math.sin(elapsedTime * 5.7) * 0.005;
    torso.scale.set(1 + breath, 1 - breath * 0.4, 1 + breath * 1.2);

    monsterGroup.rotation.z = Math.sin(elapsedTime * 0.85) * 0.025;

    const twitchSignal = Math.sin(elapsedTime * 19.0) * Math.sin(elapsedTime * 2.9);
    if (twitchSignal > 0.86) {
      headPivot.rotation.z = (Math.random() - 0.5) * 0.42;
      headPivot.rotation.y = (Math.random() - 0.5) * 0.25;
    } else {
      headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z, 0, 0.09);
      headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, 0, 0.09);
    }
  };

  return monsterGroup;
}
