// Controlli touch: metà sinistra = movimento (joystick fluttuante), metà destra = visuale.
// Su desktop: WASD/frecce + trascinamento con il mouse a destra (per test).
export function createControls(el = document.body) {
  const stick = document.getElementById('stick');
  const knob = stick.firstElementChild;
  const st = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, enabled: false, keys: new Set() };
  let mp = null, lp = null; // pointer ids
  let mo = { x: 0, y: 0 }, ll = { x: 0, y: 0 };
  const R = 46;

  el.addEventListener('pointerdown', (e) => {
    if (!st.enabled || e.target.closest('button')) return;
    const left = e.clientX < innerWidth * 0.5 && !st.aimAll;   // in combattimento ovunque tocchi = mira
    if (left && mp === null) {
      mp = e.pointerId; mo = { x: e.clientX, y: e.clientY };
      stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.style.opacity = 1;
      knob.style.transform = 'translate(0,0)';
    } else if (!left && lp === null) { lp = e.pointerId; ll = { x: e.clientX, y: e.clientY }; }
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }, { passive: false });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === mp) {
      let dx = e.clientX - mo.x, dy = e.clientY - mo.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      st.move.x = dx / R; st.move.y = dy / R;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (e.pointerId === lp) {
      st.look.x += e.clientX - ll.x; st.look.y += e.clientY - ll.y;
      ll = { x: e.clientX, y: e.clientY };
    }
  });
  const up = (e) => {
    if (e.pointerId === mp) { mp = null; st.move.x = st.move.y = 0; stick.style.opacity = 0; }
    if (e.pointerId === lp) lp = null;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  addEventListener('keydown', (e) => st.keys.add(e.code));
  addEventListener('keyup', (e) => st.keys.delete(e.code));
  addEventListener('blur', () => { st.keys.clear(); mp = lp = null; st.move.x = st.move.y = 0; stick.style.opacity = 0; });

  st.axes = () => {
    let x = st.move.x, y = st.move.y; // y avanti = negativo
    const k = st.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA')) x -= 1;
    if (k.has('KeyD')) x += 1;
    if (k.has('ArrowLeft')) st.look.x -= 6;
    if (k.has('ArrowRight')) st.look.x += 6;
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  };
  st.consumeLook = () => { const l = { x: st.look.x, y: st.look.y }; st.look.x = st.look.y = 0; return l; };
  return st;
}
