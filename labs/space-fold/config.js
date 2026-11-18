// Kill switch. The production entry point never imports this experiment.
export const SPACE_FOLD_AVAILABLE = true;

export function readFlags(search, reducedPreference = false) {
  const q = new URLSearchParams(search);
  return {
    enabled: SPACE_FOLD_AVAILABLE && q.get('spaceFold') === '1',
    reduced: q.has('reducedMotion') ? q.get('reducedMotion') === '1' : reducedPreference,
    debug: q.get('debug') === '1',
    roll: q.get('roll') !== '0',   // rotazione sull'asse del corridoio dopo la piega (?roll=0 la disattiva)
  };
}
