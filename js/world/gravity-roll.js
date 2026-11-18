// GRAVITA' CHE CAMBIA (reparto, una volta sola, ~7 s): il corridoio ruota attorno al proprio asse fino a 180° (il soffitto diventa il pavimento),
// resta capovolto un istante e rigira fino a tornare dritto. Il giocatore non puo' muoversi ma puo' guardarsi intorno.
// Si ruota solo il gruppo del reparto (nessuna geometria nuova); le luci seguono le lampade ruotate. ?gravita=0 la spegne.
import * as THREE from 'three';

const AX = 1.25;   // quota dell'asse di rotazione = meta' altezza del reparto: la stanza ruota su se stessa
const ease = (v) => { const u = Math.max(0, Math.min(1, v)); return u * u * u * (u * (u * 6 - 15) + 10); };
// angolo (rad) nel tempo: attesa 0.8 s, 0->180 in 2.6 s, fermo 1.6 s, 180->0 in 2.4 s
const T_UP0 = 0.8, T_UP1 = 3.4, T_DN0 = 5.0, T_DN1 = 7.4, T_END = 7.9;
export const rollAngle = (t) => Math.PI * (ease((t - T_UP0) / (T_UP1 - T_UP0)) - ease((t - T_DN0) / (T_DN1 - T_DN0)));

export function createGravityRoll({ group, player, camera, lights, audio, say, hideWhileActive = [], reduced = false }) {
  const G = { active: false, t: 0, done: false };
  let saved = [], said1 = false, said2 = false, hidden = [], hit = false;
  const place = (th) => { group.rotation.z = th; group.position.set(AX * Math.sin(th), AX - AX * Math.cos(th), 0); };
  const lamps = (th) => { const c = Math.cos(th), s = Math.sin(th); for (const o of saved) { const x = o.x0, y = o.y0 - AX; o.L.x = x * c - y * s; o.L.y = AX + x * s + y * c; } };
  G.start = () => {
    if (G.active || G.done) return false;
    G.active = true; G.t = 0; said1 = said2 = hit = false; player.speedMul = 0;
    saved = lights.lamps.map((L) => ({ L, x0: L.x, y0: L.y }));
    hidden = hideWhileActive.map((o) => [o, o.visible]); hidden.forEach(([o]) => { o.visible = false; });
    audio.swell?.(3.4, 0.55); audio.heartbeat?.(0.5); return true;
  };
  G.stop = (finished = true) => {
    if (!G.active) return; G.active = false; if (finished) G.done = true;
    place(0); lamps(0); saved = []; player.speedMul = 1; camera.rotation.z = 0; hidden.forEach(([o, v]) => { o.visible = v; }); hidden = [];
  };
  G.reset = () => { if (G.active) G.stop(false); G.done = false; };
  G.update = (dt) => {
    if (!G.active) return; G.t += dt; const t = G.t, th = rollAngle(t);
    place(th); lamps(th);
    if (!said1 && t > T_UP0 + 1.6) { said1 = true; audio.whisper?.(1.4, 0.2); player.addShake?.(0.35); }
    if (!said2 && t > T_UP1 + 0.1) { said2 = true; say?.('il pavimento non è più dove l’avevi lasciato.', 3200); audio.scare?.(); player.addShake?.(0.9); }
    if (!hit && t > T_DN1 - 0.05) { hit = true; audio.dash?.(0.5); player.addShake?.(1.0); }
    if (t >= T_END) G.stop(true);
  };
  return G;
}
