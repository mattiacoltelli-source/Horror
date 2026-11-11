// PWA: registrazione del service worker, banner di aggiornamento e pulsante «installa».
const $ = (id) => document.getElementById(id);
let reg = null, reloading = false;

function showBanner(worker) {
  const b = $('upd'); if (!b) return; b.classList.remove('hidden');
  $('updgo').onclick = () => { $('updgo').disabled = true; $('updgo').textContent = '…'; worker.postMessage('SKIP_WAITING'); };
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      reg = await navigator.serviceWorker.register('sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showBanner(w); });
      });
      // controlla gli aggiornamenti al ritorno nell'app e ogni 30 minuti
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    } catch (e) { console.warn('service worker non disponibile', e); }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}
// installazione: Chrome/Android propone l'evento, iOS no (istruzioni a parte)
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('install')?.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { $('install')?.classList.add('hidden'); deferred = null; });
$('install')?.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('install').classList.add('hidden'); });
