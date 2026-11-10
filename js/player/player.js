// Movimento in prima persona: collisioni semplici con i muri, head-bob, passi sincronizzati.
import * as THREE from 'three';
import { W, Z_START, Z_END } from '../world/tunnel.js';

const EYE = 1.62, RADIUS = 0.32, SPEED = 1.55, SENS = 0.0042;

export function createPlayer(camera, controls, audio) {
  const p = {
    pos: new THREE.Vector3(0.1, EYE, 1.2), yaw: 0, pitch: 0,
    shake: 0, frozen: false, bobT: 0, speedNow: 0, lastStep: 0,
    forward: new THREE.Vector3(0, 0, -1), lookMul: 1, speedMul: 1,
    addShake(a) { p.shake = Math.min(1.5, p.shake + a); },
  };
  const f = new THREE.Vector3(), r = new THREE.Vector3(), tmp = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  p.update = (dt, t) => {
    const look = controls.consumeLook();
    if (!p.frozen) {
      p.yaw -= look.x * SENS * p.lookMul;
      p.pitch = THREE.MathUtils.clamp(p.pitch - look.y * SENS * p.lookMul, -1.15, 1.15);
    }
    const a = p.frozen ? { x: 0, y: 0 } : controls.axes();
    f.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    r.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    tmp.set(0, 0, 0).addScaledVector(r, a.x).addScaledVector(f, -a.y);
    const mag = Math.min(1, Math.hypot(a.x, a.y));
    const target = mag * SPEED * p.speedMul;
    p.speedNow += (target - p.speedNow) * Math.min(1, dt * 8);
    if (mag > 0.01) {
      tmp.normalize().multiplyScalar(p.speedNow * dt);
      p.pos.x = THREE.MathUtils.clamp(p.pos.x + tmp.x, -W + RADIUS, W - RADIUS);
      p.pos.z = THREE.MathUtils.clamp(p.pos.z + tmp.z, Z_END + 0.5, Z_START - 0.4);
    }
    // head-bob + passi
    const moving = p.speedNow > 0.15;
    if (moving) {
      const prev = p.bobT;
      p.bobT += dt * p.speedNow * 4.4;
      if (Math.floor(p.bobT / Math.PI) !== Math.floor(prev / Math.PI)) audio?.step?.(p.speedNow / SPEED);
    }
    const bob = moving ? Math.sin(p.bobT) * 0.018 * (p.speedNow / SPEED) : 0;
    const sway = moving ? Math.cos(p.bobT * 0.5) * 0.012 : 0;
    p.shake = Math.max(0, p.shake - dt * 1.6);
    const sh = p.shake * p.shake;
    const n1 = Math.sin(t * 91) * sh * 0.03, n2 = Math.cos(t * 77) * sh * 0.03;
    camera.position.set(p.pos.x + sway, p.pos.y + bob + n2, p.pos.z);
    euler.set(p.pitch + n2 * 1.5, p.yaw + n1 * 1.5, n1 * 2);
    camera.quaternion.setFromEuler(euler);
    p.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  };
  return p;
}
