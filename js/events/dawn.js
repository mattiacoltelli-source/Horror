// EPILOGO — IL RISVEGLIO. Dopo che lei ti ha preso: buio, poi sei sdraiato all'aperto, di notte, sotto un cielo con la Via Lattea.
// Silenzio e vento. Ti alzi piano e puoi guardarti intorno. Nessuna spiegazione. Dopo un po' tutto sfuma sulla scritta finale.
import * as THREE from 'three';

export function createDawn({ scene, camera, player, audio, lights, instab, say, finish, onStart }) {
  const D = { active: false, t: 0, text: '', said: 0, ended: false };
  const tex = new THREE.TextureLoader().load('assets/tex/night_bg.jpg'); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
  sky.visible = false; sky.renderOrder = -10; scene.add(sky);
  let wind = null; const fade = document.getElementById('fade');

  D.start = (text) => {
    if (D.active) return; D.active = true; D.t = 0; D.text = text || ''; D.said = 0;
    onStart?.();                                   // via pistola e interfaccia di tiro
    // via tutto il resto: resta solo il cielo
    scene.children.forEach((o) => { if (o !== sky && !o.isLight && o !== camera) o.visible = false; });
    scene.fog.density = 0; scene.background = new THREE.Color(0x000000); scene.environment = null;
    lights.setTorch(false); lights.override = 0; lights.setLamps([]); instab.hide();
    sky.visible = true; sky.position.set(0, 0, 0);
    player.box = [-0.3, 0.3, -0.3, 0.3]; player.pos.set(0, 0.28, 0); player.yaw = D.yaw0 ?? 4.45; player.pitch = 0.82; player.frozen = false; player.speedMul = 0; player.lookMul = 0.9;
    audio.duck(0, 0.1); audio.unmute?.(); wind = audio.wind(0.9);
    fade.style.background = '#000'; fade.style.transition = 'none'; fade.style.opacity = 1; void fade.offsetWidth;
    setTimeout(() => { fade.style.transition = 'opacity 5s ease'; fade.style.opacity = 0; }, 1500);   // un secondo e mezzo di buio, poi il cielo emerge piano
    const ec = document.getElementById('act'); ec?.classList.add('hidden');
  };

  D.update = (dt) => {
    if (!D.active || D.ended) return; D.t += dt; const t = D.t;
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);   // il cielo segue l'occhio: è all'infinito
    // ti alzi: da sdraiato (28 cm) a in piedi (1.62 m), lentamente, dopo qualche secondo di quiete
    const k = THREE.MathUtils.clamp((t - 7) / 7, 0, 1), e = k * k * (3 - 2 * k);
    player.pos.y = THREE.MathUtils.lerp(0.28, 1.62, e);
    if (t > 7 && t < 14) player.pitch += (0.12 - player.pitch) * Math.min(1, dt * 0.5);       // lo sguardo scende verso l'orizzonte mentre ti alzi
    if (t > 3 && D.said === 0) { D.said = 1; say('', 1); }
    if (t > 15 && D.said === 1) { D.said = 2; say('è tutto fermo.', 5200); }
    if (t > 28 && D.said === 2) { D.said = 3; say('', 1); }
    // dopo ~34 s (o un tocco lungo) il finale
    if (t > 34) { D.ended = true; wind?.stop(); finish(D.text, false); }
  };
  return D;
}
