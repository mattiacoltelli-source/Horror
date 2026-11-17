export const QUALITY = {
  high: { pr: 1.5, aa: true, an: 4 },
  mid: { pr: 1.15, aa: false, an: 2 },
  low: { pr: 0.8, aa: false, an: 1 },
};

export function chooseQuality(saved, { touch = false, memory = 0, cores = 0 } = {}) {
  if (Object.hasOwn(QUALITY, saved)) return saved;
  return touch || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4) ? 'mid' : 'high';
}

// Usa il tempo reale dei frame, separato dal passo limitato delle collisioni.
// Una finestra evita di abbassare la qualita' per un singolo scatto isolato.
export function createAdaptiveResolution(initial, minimum = 0.7) {
  let ratio = initial, seconds = 0, frames = 0, slowAtFloor = 0, trimmed = false;
  const reset = () => { seconds = 0; frames = 0; slowAtFloor = 0; };
  return {
    reset,
    sample(elapsed) {
      if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > 1) { reset(); return null; }
      seconds += elapsed; frames++;
      if (seconds < 1.5 || frames < 6) return null;
      const fps = frames / seconds, duration = seconds; seconds = 0; frames = 0;
      if (fps < 38 && ratio > minimum) {
        ratio = Math.max(minimum, Math.round((ratio - (fps < 24 ? 0.2 : 0.15)) * 100) / 100);
        slowAtFloor = 0;
        return { ratio };
      }
      slowAtFloor = fps < 28 && ratio <= minimum ? slowAtFloor + duration : 0;
      if (!trimmed && slowAtFloor >= 3) { trimmed = true; return { trim: true }; }
      return null;
    },
  };
}
