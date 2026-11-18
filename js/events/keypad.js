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
  // modello moderno (stona apposta col resto): placca in alluminio nero spazzolato, vetro scuro, display OLED, tasti retroilluminati
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.034), new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.35, metalness: 0.85 })); body.position.z = -0.017; root.add(body);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.326, 0.006), new THREE.MeshStandardMaterial({ color: 0x3c3e43, roughness: 0.45, metalness: 0.7 })); bezel.position.z = -0.003; root.add(bezel);
  const W = 512, H = 800, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const ce = document.createElement('canvas'); ce.width = W; ce.height = H; const ge = ce.getContext('2d');   // mappa emissiva: cio' che si illumina da solo
  const rr = (k, x, y, w, h, r) => { k.beginPath(); k.roundRect(x, y, w, h, r); };
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.035 + ')'; g.fillRect(0, Math.random() * H, W, 1); }   // spazzolatura
  // display OLED
  rr(g, 40, 44, 432, 118, 14); g.fillStyle = '#020305'; g.fill(); g.strokeStyle = '#26282d'; g.lineWidth = 3; g.stroke();
  g.font = '500 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5d7c8c'; g.fillText('INSERIRE CODICE', 256, 84);
  ge.font = g.font; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillStyle = '#5d7c8c'; ge.fillText('INSERIRE CODICE', 256, 84);
  for (let i = 0; i < 6; i++) { const cx = 96 + i * 64; rr(g, cx - 18, 128, 36, 5, 2); g.fillStyle = '#2d4452'; g.fill(); rr(ge, cx - 18, 128, 36, 5, 2); ge.fillStyle = '#2d4452'; ge.fill(); }
  // tasti: vetro scuro con cifra luminosa
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  g.font = '600 56px sans-serif'; ge.font = g.font;
  labels.forEach((t, i) => { const cx = 46 + (i % 3) * 144, cy = 204 + Math.floor(i / 3) * 128, w = 128, h = 108;
    rr(g, cx, cy, w, h, 22); const gr = g.createLinearGradient(0, cy, 0, cy + h); gr.addColorStop(0, '#2a2c31'); gr.addColorStop(1, '#17181b'); g.fillStyle = gr; g.fill(); g.strokeStyle = '#3b3e44'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e8f3f8'; g.fillText(t, cx + w / 2, cy + h / 2 + 3); ge.fillStyle = '#9fd8ec'; ge.fillText(t, cx + w / 2, cy + h / 2 + 3);
    rr(ge, cx + 20, cy + h - 10, w - 40, 3, 2); ge.fillStyle = '#143c4a'; ge.fill(); });
  // striscia di stato in basso
  g.fillStyle = '#2c2f34'; g.fillRect(46, 738, 420, 2); g.font = '500 20px sans-serif'; g.fillStyle = '#6f757c'; g.fillText('ACCESS CONTROL  ·  SERIES 7', 256, 768);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const etex = new THREE.CanvasTexture(ce); etex.colorSpace = THREE.SRGBColorSpace; etex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19 * H / W), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: etex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.18, metalness: 0.5 })); face.position.set(0, 0, 0.0005); root.add(face);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a0b08 })); led.position.set(0.082, 0.147, 0.002); root.add(led);
  const ledRing = new THREE.Mesh(new THREE.RingGeometry(0.0085, 0.0115, 16), new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 1, roughness: 0.3 })); ledRing.position.set(0.082, 0.147, 0.0015); root.add(ledRing);
  const setLed = (col) => led.material.color.setHex(col);
  K.reset = () => { K.open = false; K.code = ''; setLed(0x5a0b08); hide(); K.near = false; actBtn.classList.add('hidden'); };

  // ---- pannello a schermo (touch): display a 6 cifre + tasti 3x4 ----
  const css = document.createElement('style'); css.textContent = `
#codepad{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#codepad.on{display:flex}
#codepad .box{background:linear-gradient(#17181b,#0d0e10);border:1px solid #3a3d43;border-radius:18px;padding:20px 18px 16px;width:min(300px,86vw);box-shadow:0 0 50px #000}
#codepad .scr{font:600 34px/1 ui-monospace,monospace;letter-spacing:.35em;text-align:center;color:#9fd8ec;background:#020305;border:1px solid #26282d;border-radius:10px;padding:14px 0 14px .35em;margin-bottom:14px;min-height:36px}
#codepad .scr.bad{color:#c2362a;animation:cpshake .35s}@keyframes cpshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#codepad .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#codepad button{min-height:62px;font:600 24px ui-monospace,monospace;color:#e8f3f8;background:linear-gradient(#2a2c31,#17181b);border:1px solid #3b3e44;border-radius:12px}
#codepad button:active{background:#33363c;color:#9fd8ec}
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
