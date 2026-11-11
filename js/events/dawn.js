// EPILOGO — IL RISVEGLIO. Dopo che lei ti ha preso: buio, poi sei sdraiato all'aperto, di notte, sotto un cielo con la Via Lattea.
// Silenzio e vento. Ti alzi piano e puoi guardarti intorno. Nessuna spiegazione. Dopo un po' tutto sfuma sulla scritta finale.
import * as THREE from 'three';

export function createDawn({ scene, camera, player, audio, lights, instab, say, finish, onStart, hall }) {
  const D = { active: false, t: 0, text: '', said: 0, ended: false };
  const tex = new THREE.TextureLoader().load('assets/tex/night_bg.jpg'); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
  sky.visible = false; sky.renderOrder = -10; scene.add(sky);
  const far = hall.silhouette(0); far.visible = false; scene.add(far); let breath = null, farT = -1, farLook = 0, farYaw = 0;
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
    setTimeout(() => { fade.style.transition = 'opacity 3s ease'; fade.style.opacity = 0; }, 800);   // meno di un secondo di buio, poi il cielo emerge
    const ec = document.getElementById('act'); ec?.classList.add('hidden');
  };

  const ep = new THREE.Vector3();
  D.update = (dt) => {
    if (!D.active || D.ended) return; D.t += dt; const t = D.t; instab.hide();   // il punto non c'è più: qui non sei più in pericolo
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);   // il cielo segue l'occhio: è all'infinito
    // ti alzi: da sdraiato (28 cm) a in piedi (1.62 m), lentamente, dopo qualche secondo di quiete
    const k = THREE.MathUtils.clamp((t - 4) / 4, 0, 1), e = k * k * (3 - 2 * k);
    player.pos.y = THREE.MathUtils.lerp(0.28, 1.62, e);
    if (t > 4 && t < 8) player.pitch += (0.12 - player.pitch) * Math.min(1, dt * 0.5);       // lo sguardo scende verso l'orizzonte mentre ti alzi
    if (t > 2 && D.said === 0) { D.said = 1; say('', 1); }
    if (t > 8.5 && D.said === 1) { D.said = 2; say('è tutto fermo.', 4000); }
    // FINALE: sei solo. Il vento si ferma di colpo, silenzio; un respiro lontano alle tue spalle si avvicina piano, passo dopo passo.
    // Non c'è nessuno da vedere. Quando è a un soffio da te, tutto si spegne di colpo: buio e silenzio.
    if (t > 11.5 && D.said === 2) { D.said = 3; wind?.stop(0.12); wind = null; }
    if (t > 13 && D.said === 3) { D.said = 4; breath = audio.breath(); breath?.setLevel(0.3, 0.8); D.bt = 0; }
    if (D.said >= 4 && breath) {
      D.bt += dt; const k = Math.min(1, D.bt / 8), e = k * k, dist = THREE.MathUtils.lerp(10, 0.9, e), a = player.yaw + Math.PI;
      breath.setPos(camera.position.x + Math.sin(a) * dist, 1.3, camera.position.z + Math.cos(a) * dist); breath.setLevel(0.3 + 0.9 * e, 0.5);
      if (k >= 1 && D.said === 4) { D.said = 5; audio.cut(0.02); fade.style.transition = 'opacity .12s'; fade.style.opacity = 1; D.endAt = t + 1.8; }   // buio e silenzio di colpo
    }
    if (t > (D.endAt ?? 40)) { D.ended = true; wind?.stop(); breath?.stop(); audio.unmute?.(); finish(D.text, true); }
  };
  return D;
}
