// TASTIERINO A PARETE (cantina, muro destro, accanto alla luce rossa d'emergenza, fuori dalla cripta): si guarda, compare CODICE, si digitano 6 cifre.
// Con il codice giusto si accende il LED verde e si apre il portale a terra nella cripta. Con uno sbagliato: LED rosso, il pannello si azzera.
// Il codice non e' scritto in chiaro nel sorgente: si confronta un hash (djb2).
import * as THREE from 'three';

const HASH = 2114326775 >>> 0;   // djb2 del codice
const djb2 = (t) => { let h = 5381; for (const c of t) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h >>> 0; };

export function createKeypad({ group, player, audio, say, actBtn, flags, x, y, z, onOpen }) {
  const K = { near: false, open: false, code: '' };
  // ---- modello: placca di metallo scuro con la faccia disegnata (tasti consumati, display) e un LED ----
  const root = new THREE.Group(); root.name = 'tastierino-codice'; root.position.set(x - 0.016, y, z); root.rotation.y = -Math.PI / 2; group.add(root);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.03), new THREE.MeshStandardMaterial({ color: 0x1c1d1b, roughness: 0.75, metalness: 0.6 })); body.position.z = -0.015; root.add(body);
  const c = document.createElement('canvas'); c.width = 256; c.height = 376; const g = c.getContext('2d');
  g.fillStyle = '#2a2b27'; g.fillRect(0, 0, 256, 376);
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(' + (60 + Math.random() * 60 | 0) + ',' + (40 + Math.random() * 30 | 0) + ',25,' + Math.random() * 0.12 + ')'; g.fillRect(Math.random() * 256, Math.random() * 376, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  g.fillStyle = '#0a0c0a'; g.fillRect(24, 22, 208, 52);   // display spento
  g.strokeStyle = '#4a4a44'; g.lineWidth = 3; g.strokeRect(24, 22, 208, 52);
  g.font = 'bold 44px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
  labels.forEach((t, i) => { const cx = 24 + (i % 3) * 72 + 8, cy = 98 + Math.floor(i / 3) * 66, w = 56, h = 50;
    if (!t) return; g.fillStyle = '#3a3b36'; g.fillRect(cx, cy, w, h); g.strokeStyle = '#161714'; g.lineWidth = 3; g.strokeRect(cx, cy, w, h);
    g.fillStyle = '#b9b4a2'; g.fillText(t, cx + w / 2, cy + h / 2 + 2); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.27 * 376 / 256 * 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.2, color: new THREE.Color(0.8, 0.78, 0.74) })); face.position.set(0, -0.005, 0.0005); root.add(face);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5a0b08 })); led.position.set(0.105, 0.178, 0.004); root.add(led);
  const setLed = (col) => led.material.color.setHex(col);
  K.reset = () => { K.open = false; K.code = ''; setLed(0x5a0b08); hide(); K.near = false; actBtn.classList.add('hidden'); };

  // ---- pannello a schermo (touch): display a 6 cifre + tasti 3x4 ----
  const css = document.createElement('style'); css.textContent = `
#codepad{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#codepad.on{display:flex}
#codepad .box{background:#161713;border:1px solid #4a4b43;padding:18px 18px 14px;width:min(300px,86vw);box-shadow:0 0 40px #000}
#codepad .scr{font:600 34px/1 ui-monospace,monospace;letter-spacing:.35em;text-align:center;color:#c9d3b8;background:#070907;border:1px solid #2c2f2a;padding:14px 0 14px .35em;margin-bottom:14px;min-height:36px}
#codepad .scr.bad{color:#c2362a;animation:cpshake .35s}@keyframes cpshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#codepad .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#codepad button{min-height:62px;font:600 24px ui-monospace,monospace;color:#cfcab8;background:#2b2c27;border:1px solid #4a4b43;border-radius:4px}
#codepad button:active{background:#3b3c35}
#codepad .ex{grid-column:1/4;margin-top:4px;min-height:48px;font-size:14px;letter-spacing:.2em;color:#8a8e84}`;
  document.head.appendChild(css);
  const pad = document.createElement('div'); pad.id = 'codepad'; pad.setAttribute('role', 'dialog');
  pad.innerHTML = '<div class="box"><div class="scr" id="cpscr">······</div><div class="grid">' + '123456789'.split('').map((d) => '<button data-k="' + d + '">' + d + '</button>').join('') + '<button data-k="del">⌫</button><button data-k="0">0</button><button data-k="x">✕</button><button class="ex" data-k="x">ESCI</button></div></div>';
  document.body.appendChild(pad);
  const scr = pad.querySelector('#cpscr');
  const show = () => { K.code = ''; paint(); pad.classList.add('on'); player.frozen = true; K.padOn = true; };
  function hide() { if (!K.padOn) return; pad.classList.remove('on'); player.frozen = false; K.padOn = false; }
  const paint = () => { scr.textContent = (K.code + '······').slice(0, 6); scr.classList.remove('bad'); };
  const press = (k) => {
    if (!K.padOn) return;
    if (k === 'x') { hide(); return; }
    if (k === 'del') { K.code = K.code.slice(0, -1); paint(); return; }
    if (!/^\d$/.test(k) || K.code.length >= 6) return;
    K.code += k; paint(); audio.keypad?.(k);
    if (K.code.length === 6) {
      if (djb2(K.code) === HASH) { K.open = true; setLed(0x2bff5a); audio.keypadOk?.(); setTimeout(hide, 450); setTimeout(() => { audio.swell?.(2.4, 0.4); say('Qualcosa si apre nella cripta.', 3600); onOpen?.(); }, 600); }
      else { setLed(0xff2a1c); scr.classList.add('bad'); audio.keypadBad?.(); setTimeout(() => { K.code = ''; paint(); setLed(0x5a0b08); }, 650); }
    }
  };
  pad.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) press(b.dataset.k); else if (e.target === pad) hide(); });
  addEventListener('keydown', (e) => { if (!K.padOn) return; if (e.key === 'Escape') hide(); else if (e.key === 'Backspace') press('del'); else if (/^\d$/.test(e.key)) press(e.key); });

  // ---- prompt: guardare il tastierino da vicino ----
  const target = new THREE.Vector3(x, y, z), dir = new THREE.Vector3();
  K.update = (dt, active) => {
    let next = false;
    if (active && !K.open && !K.padOn && !player.frozen) { dir.copy(target).sub(player.pos); const d = dir.length(); if (d < 1.9 && dir.normalize().dot(player.forward) > 0.9) next = true; }
    if (next !== K.near) { K.near = next; if (next) { actBtn.textContent = 'CODICE'; actBtn.classList.remove('hidden'); } else actBtn.classList.add('hidden'); }
    if (!active && K.padOn) hide();
  };
  K.act = () => { if (!K.near || K.open) return; K.near = false; actBtn.classList.add('hidden'); show(); };
  return K;
}
