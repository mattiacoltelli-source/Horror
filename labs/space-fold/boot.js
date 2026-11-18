import { readFlags } from './config.js';
const flags=readFlags(location.search,matchMedia('(prefers-reduced-motion: reduce)').matches);
const $=id=>document.getElementById(id);
$('reduced').checked=flags.reduced;
if (flags.enabled) {
  $('enable').hidden=true;
  $('status').textContent='Preparazione del reparto…';
  // No renderer, assets, audio, input listeners or animation loop when disabled.
  import('./lab.js').then(({startLab})=>startLab(flags)).catch(error=>{
    console.error(error); $('overlay').hidden=false;
    $('status').textContent='Impossibile preparare la prova. Ricarica la pagina per riprovare.';
    $('start').hidden=true;
  });
} else if (new URLSearchParams(location.search).get('spaceFold')==='1') {
  $('status').textContent='Il prototipo è disabilitato dal kill switch.';
  $('enable').hidden=true;
}
