// A single subtitle track. Only the game clock advances reading and waiting;
// pausing, a room change or a spectacle cannot leave an old wall-clock callback.
export function createNarration({ element, blocked = () => false }) {
  let active = null, queue = [], clock = 0, gap = 0;
  const hide = () => { element.style.opacity = 0; };
  const paint = () => {
    element.classList.toggle('note', active.style === 'note');
    element.classList.toggle('urgent', active.style === 'urgent');
    element.textContent = active.text; element.style.opacity = 1;
  };
  const begin = (line) => { active = line; paint(); };
  const reset = () => { active = null; queue = []; gap = 0; hide(); };
  const say = (text, ms = 4000, style = '') => {
    if (!text) { reset(); return true; }
    if (active?.text === text || queue.some((line) => line.text === text)) return true;
    const line = { text, style, remaining: ms, expires: style === 'note' ? Infinity : clock + 12000 };
    if (style === 'urgent') { reset(); begin(line); return true; }
    if (queue.length >= 4 - (active ? 1 : 0)) {
      const disposable = queue.findIndex((item) => item.style !== 'note');
      if (disposable < 0) return false;
      queue.splice(disposable, 1);
    }
    if (style === 'note') {
      const lastNote = queue.findLastIndex((item) => item.style === 'note');
      queue.splice(lastNote + 1, 0, line);
    } else queue.push(line);
    say.update(0);
    return true;
  };
  say.update = (dt) => {
    const elapsed = Math.max(0, dt) * 1000; clock += elapsed;
    const quiet = blocked();
    if (quiet && active && active.style !== 'urgent') {
      queue.unshift(active); active = null; hide();
    }
    if (active) {
      active.remaining -= elapsed;
      if (active.remaining <= 0) { active = null; gap = 350; hide(); }
    } else gap = Math.max(0, gap - elapsed);
    queue = queue.filter((line) => line.expires > clock);
    if (!quiet && !active && !gap && queue.length) begin(queue.shift());
  };
  say.canRead = () => !blocked() && !active && !queue.length && gap <= 0;
  say.blocked = blocked;
  say.idle = () => !active && !queue.length && gap <= 0;
  say.reset = say.clear = reset;
  Object.defineProperty(say, 'noteUntil', { get: () => {
    const note = active?.style === 'note' ? active : queue.find((line) => line.style === 'note');
    return note ? performance.now() + note.remaining : 0;
  } });
  return say;
}
