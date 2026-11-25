// Fumo dal tombino: forma incompleta e occhi nel vapore. Una sola mesh
// instanziata, nessun modello o caricamento, nessuna geometria di collisione.
import * as THREE from 'three';

const COUNT = 128, X = .3, Z = -45, FORM_TIME = 3.1, FADE_TIME = 3.8;
const REGIONS = [
  [368, 104, 31, 35, -.31, 18], [349, 147, 62, 37, .43, 27],
  [373, 187, 55, 49, -.52, 26], [311, 186, 49, 14, -.61, 12],
  [413, 151, 52, 14, .52, 10], [393, 221, 45, 17, -.76, 12],
  [358, 251, 24, 58, .09, 23],
];

function smokeStamp() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), image = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x - 63.5) / 64, v = (y - 63.5) / 64, r = u * u + v * v;
    const n = .76 + .13 * Math.sin(x * .19 + Math.sin(y * .14) * 2) + .11 * Math.sin(y * .31 - x * .13);
    const a = Math.exp(-r * 4.6) * Math.max(0, 1 - r) * n;
    const i = (y * 128 + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
    image.data[i + 3] = Math.round(Math.max(0, a) * 255);
  }
  g.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(c);
}

function eyesStamp() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (const side of [-1, 1]) {
    g.save(); g.translate(64 + side * 22, 32 - side); g.scale(side, 1);
    const glow = g.createRadialGradient(0, 0, 1, 0, 0, 22);
    glow.addColorStop(0, '#9a202c40'); glow.addColorStop(.45, '#78101d18'); glow.addColorStop(1, '#78101d00');
    g.fillStyle = glow; g.fillRect(-22, -22, 44, 44);
    g.beginPath(); g.moveTo(-9, 2); g.quadraticCurveTo(-1, -1, 10, -5);
    g.quadraticCurveTo(10, 3, 1, 4); g.quadraticCurveTo(-5, 5, -9, 2);
    g.shadowColor = '#7e1725'; g.shadowBlur = 3; g.fillStyle = '#a33240'; g.fill();
    g.shadowBlur = 0; g.fillStyle = '#bb5960'; g.beginPath(); g.ellipse(1, 0, 1.8, .8, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function drainStamp() {
  // Qualita' bassa nasconde il kit decorativo: una grata piatta mantiene la
  // sorgente leggibile anche allora, senza un secondo modello o luci aggiunte.
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#262c2c'; g.beginPath(); g.arc(64, 64, 61, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#42413b'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#080b0b';
  for (let i = -2; i <= 2; i++) { const x = 64 + i * 19, h = 76 - Math.abs(i) * 12; g.fillRect(x - 4, 64 - h / 2, 8, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createDrainPresence({ scene, player, lights, audio, glass, isActive = () => true, reduced = false }) {
  const group = new THREE.Group(); group.name = 'presenza-dal-tombino'; group.position.set(X, 0, Z); group.visible = false; scene.add(group);
  const D = { group, state: 'wait', t: 0, formed: 0, dissolved: 0, ready: false };
  const map = smokeStamp(), eyeMap = eyesStamp(), grateMap = drainStamp();
  const target = [], origin = [], radii = [], alpha = [], phase = [];
  let seed = 7103;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const slots = [-.27, -.16, -.05, .05, .16, .27];
  for (const [cx, cy, rx, ry, angle, count] of REGIONS) for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, distance = Math.sqrt(rnd()), x = Math.cos(a) * rx * distance, y = Math.sin(a) * ry * distance;
    target.push((cx + x * Math.cos(angle) - y * Math.sin(angle) - 360) * .01,
      Math.max(.035, (303 - cy - x * Math.sin(angle) - y * Math.cos(angle)) * .01), (rnd() - .5) * .34);
    const slot = slots[Math.floor(rnd() * slots.length)];
    origin.push(slot * Math.cos(.7), .026, slot * Math.sin(.7));
    radii.push(.34 + rnd() * .55); alpha.push(.11 + rnd() * .09); phase.push(rnd() * Math.PI * 2);
  }
  const plane = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index; geometry.setAttribute('position', plane.attributes.position); geometry.setAttribute('uv', plane.attributes.uv);
  for (const [name, values, size] of [['aTarget', target, 3], ['aOrigin', origin, 3], ['aRadius', radii, 1], ['aAlpha', alpha, 1], ['aPhase', phase, 1]])
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), size));
  geometry.instanceCount = COUNT;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uMap: { value: map }, uTime: { value: 0 }, uForm: { value: 0 }, uDissolve: { value: 0 },
    uMotion: { value: reduced ? 0 : 1 }, uColor: { value: new THREE.Color(0x7d8e96) },
  }]);
  uniforms.uMap.value = map;   // initTexture prepara proprio la texture usata dal materiale
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, depthTest: true, fog: true,
    vertexShader: `attribute vec3 aTarget, aOrigin; attribute float aRadius, aAlpha, aPhase;
      uniform float uTime, uForm, uDissolve, uMotion; varying vec2 vUv; varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        float rise = smoothstep(0.0, 1.0, uForm);
        float spread = clamp((uDissolve - aPhase * .028) / .824, 0.0, 1.0);
        vec3 p = mix(aOrigin, aTarget, rise);
        float sway = sin(uTime * .67) * .10, drift = sin(uTime * .71 + aPhase + aTarget.y * 3.5);
        p.x += (sway * aTarget.y * .45 + drift * .07) * rise * uMotion;
        p.y += cos(uTime * .53 + aPhase) * .045 * rise * uMotion;
        p.x += sin(aPhase + uTime * .22 * uMotion) * spread * (.35 + aTarget.y * .16);
        p.y += spread * (.24 + aTarget.y * .26) * (.25 + .75 * uMotion);
        p.z += cos(aPhase * 1.3) * spread * .35;
        float scale = mix(.035, aRadius, rise) * (1.0 + spread * 1.5);
        float glimpse = .60 + .20 * pow(.5 + .5 * sin(uTime * .83), 2.0);
        vAlpha = aAlpha * smoothstep(0.0, .18, uForm) * glimpse * pow(1.0 - spread, 2.0);
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        mvPosition.xy += position.xy * scale;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D(uMap, vUv).a * vAlpha;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const cloud = new THREE.Mesh(geometry, material); cloud.name = 'fumo-istanzato'; cloud.frustumCulled = false; group.add(cloud);
  const eyeMaterial = new THREE.SpriteMaterial({ map: eyeMap, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false });
  const eyes = new THREE.Sprite(eyeMaterial); eyes.name = 'occhi-nel-fumo'; eyes.position.set(.08, 1.91, 0); eyes.scale.set(.44, .22, 1); group.add(eyes);
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(.78, .78), new THREE.MeshBasicMaterial({ map: grateMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  grate.name = 'grata-del-fumo-qualita-bassa'; grate.rotation.x = -Math.PI / 2; grate.rotation.z = -.7;
  grate.position.set(X, .018, Z); grate.visible = false; scene.add(grate); D.grate = grate;
  let elapsed = 0, wind = null;
  const stop = () => { wind?.stop(.25); wind = null; };
  D.prepare = async (renderer, camera) => {
    if (D.ready) return;
    for (const texture of [map, eyeMap, grateMap]) renderer.initTexture?.(texture);
    const visible = group.visible; let preparation;
    try { group.visible = true; preparation = renderer.compileAsync?.(group, camera, scene); }
    finally { group.visible = visible; }
    await preparation; D.ready = true;
  };
  D.update = (dt) => {
    const active = isActive(); grate.visible = !!active && !!globalThis.__lowQ;
    if (!active || D.state === 'gone') { group.visible = false; stop(); return; }
    const z = player.pos.z;
    if (z < -48.5) { D.state = 'gone'; group.visible = false; stop(); return; }
    if (!lights.lamps[3]) return;
    if (D.state === 'wait') {
      group.visible = false;
      if (z < -8 && (glass?.done || (glass?.state === 'vanish' && glass.t > .9))) {
        D.state = 'rising'; D.t = 0; group.visible = true; wind = audio.wind?.(.09);
      } else return;
    }
    elapsed += dt; D.t += dt; group.visible = true;
    lights.lamp(3, 'off');
    if (D.state === 'rising') {
      D.formed = Math.min(1, D.t / FORM_TIME);
      if (D.formed === 1) { D.state = 'formed'; D.t = 0; }
    } else if (D.state === 'formed' && z < -35.8) { D.state = 'dissolving'; D.t = 0; }
    else if (D.state === 'dissolving') {
      D.dissolved = Math.min(1, D.t / (reduced ? 4.4 : FADE_TIME));
      if (D.dissolved >= 1) { D.state = 'gone'; group.visible = false; stop(); lights.lamp(3, 'on'); }
    }
    uniforms.uTime.value = reduced ? 1.8 : elapsed;
    uniforms.uForm.value = D.formed; uniforms.uDissolve.value = D.dissolved;
    const face = THREE.MathUtils.smoothstep(D.formed, .50, .85), breathe = reduced ? .7 : .56 + .16 * Math.sin(elapsed * .83);
    eyeMaterial.opacity = face * breathe * Math.pow(1 - D.dissolved, 2.7);
    eyes.position.set(.08 + (reduced ? 0 : Math.sin(elapsed * .67) * .09) * D.formed, 1.91 + (reduced ? 0 : Math.sin(elapsed * .83) * .025), 0);
  };
  Object.defineProperty(D, 'holdNarration', { get: () => {
    if (!group.visible) return false;
    const x = X - player.pos.x, y = 1.3 - player.pos.y, z = Z - player.pos.z, f = player.forward;
    return (x * f.x + y * f.y + z * f.z) / Math.hypot(x, y, z) > .5;
  } });
  D.metrics = { instances: COUNT, triangles: COUNT * 2 + 4, maxDrawCalls: 3 };
  return D;
}
