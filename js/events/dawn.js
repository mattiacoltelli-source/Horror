// EPILOGO — IL RISVEGLIO. Dopo che lei ti ha preso: buio, poi sei sdraiato all'aperto, di notte, sotto un cielo con la Via Lattea.
// Silenzio e vento. Ti alzi piano e puoi guardarti intorno. Nessuna spiegazione. Dopo un po' tutto sfuma sulla scritta finale.
import * as THREE from 'three';

export function createDawn({ scene, camera, player, audio, lights, instab, say, finish, onStart, hall }) {
  const D = { active: false, t: 0, text: '', said: 0, ended: false };
  const tex = new THREE.TextureLoader().load('assets/tex/night_bg.jpg'); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
  sky.visible = false; sky.renderOrder = -10; scene.add(sky); const skyMat = sky.material;
  const far = hall.silhouette(0); far.visible = false; scene.add(far); let breath = null, farT = -1, farLook = 0, farYaw = 0;
  let wind = null; const fade = document.getElementById('fade');

  D.start = (text) => {
    if (D.active) return; D.active = true; D.t = 0; D.text = text || ''; D.said = 0;
    onStart?.(); camera.children.forEach((c) => { if (c.isPoints) c.visible = false; });   // all'aperto niente polvere della torcia
                                   // via pistola e interfaccia di tiro
    // via tutto il resto: resta solo il cielo
    scene.children.forEach((o) => { if (o !== sky && !o.isLight && o !== camera) o.visible = false; });
    camera.far = 60; camera.updateProjectionMatrix(); scene.fog.density = 0; scene.background = new THREE.Color(0x000000); scene.environment = null;
    lights.setTorch(false); lights.override = 0; lights.setLamps([]); instab.hide();
    sky.visible = true; sky.position.set(0, 0, 0);
    player.box = [-0.3, 0.3, -0.3, 0.3]; player.pos.set(0, 0.28, 0); player.yaw = D.yaw0 ?? 4.45; player.pitch = 0.82; player.frozen = false; player.speedMul = 0; player.lookMul = 0.9;
    audio.duck(0, 0.1); audio.unmute?.(); wind = audio.wind(0.9);
    fade.style.background = '#000'; fade.style.transition = 'none'; fade.style.opacity = 1; void fade.offsetWidth;
    setTimeout(() => { fade.style.transition = 'opacity 3s ease'; fade.style.opacity = 0; }, 800);   // meno di un secondo di buio, poi il cielo emerge
    const ec = document.getElementById('act'); ec?.classList.add('hidden');
  };

  const ep = new THREE.Vector3();
  // OMBRA: massa d'oscurità vaga (stesso tipo di quella dello specchio), non una figura. Vive davanti alla camera e le va incontro.
  const NZ = `float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+1.7;a*=.5;}return v;}`;
  const shMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uT, uA;\n${NZ}
      void main(){
        vec2 p = (vUv - vec2(0.5, 0.46)) * vec2(2.0, 1.0);
        p.x += 0.32 * (fbm(vec2(p.y * 1.6, uT * 0.7)) - 0.5);                       // contorno che ondeggia, mai fermo
        float core = exp(-pow(p.x * 1.35, 2.0)) * smoothstep(-0.62, -0.1, p.y) * (1.0 - smoothstep(0.1, 0.62, p.y));
        float cl = fbm(vUv * 5.0 + vec2(uT * 0.5, -uT * 0.9));
        float tendril = fbm(vec2(p.x * 3.0 + uT * 0.4, p.y * 1.2)) ;
        float a = clamp(core * smoothstep(0.1, 0.5, cl + core * 0.7) + 0.55 * core * tendril, 0.0, 1.0);
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);   // niente bordo rettangolare
        gl_FragColor = vec4(vec3(0.0), clamp(a * uA * edge, 0.0, 1.0));
      }` });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shMat); shadow.renderOrder = 50; shadow.frustumCulled = false; shadow.visible = false; camera.add(shadow);
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
      // il cielo si spegne piano mentre il respiro si fa vicino: tutto più buio, la penombra in cui qualcosa può arrivare
      const dim = THREE.MathUtils.clamp((k - 0.35) / 0.55, 0, 1); skyMat.color.setScalar(1 - 0.62 * dim);
      if (k >= 0.9 && D.said === 4) { D.said = 5; D.rt = 0; audio.swell?.(0.7, 0.6); shadow.visible = true; shadow.position.set(0, 0, -30); }
    }
    if (D.said === 5) {
      D.rt += dt; const r = Math.min(1, D.rt / 0.85), e = r * r * r;                 // accelera: lenta all'inizio, poi addosso
      shMat.uniforms.uT.value = D.rt; shMat.uniforms.uA.value = Math.min(1, r * 3);
      const z = THREE.MathUtils.lerp(-15, -0.7, e), sc = 1.25;                      // altezza reale ~2.5 m: la prospettiva la ingrandisce da sola
      shadow.position.set(Math.sin(D.rt * 9) * 0.02 * e, 0, z); shadow.scale.set(sc * 0.95, sc * 1.15, 1);
      if (r > 0.55 && !D.hit0) { D.hit0 = true; breath?.setLevel(1.8, 0.05); }
      if (r >= 1 && D.said === 5) {
        D.said = 6; audio.scare(); player.addShake(1.6); try { navigator.vibrate?.([140, 40, 180]); } catch (_) {}
        camera.fov = (camera.userData.baseFov ?? 68) + 14; camera.updateProjectionMatrix();
        fade.style.background = '#000'; fade.style.transition = 'opacity .06s'; fade.style.opacity = 1; D.endAt = D.t + 2.4;
        setTimeout(() => { audio.cut(0.03); }, 380);
      }
    }
    if (t > (D.endAt ?? 40)) { D.ended = true; wind?.stop(); breath?.stop(); shadow.visible = false; camera.fov = camera.userData.baseFov ?? 68; camera.updateProjectionMatrix(); audio.unmute?.(); finish(D.text, true); }
  };
  return D;
}
