// node tools/check_memory_audio.cjs [anteprima.wav]
// Contratto e cancellazione con clock simulato + rendering Web Audio nativo offline.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/audio/motif.js'), 'utf8');
class Param {
  constructor(value = 1) { this.value = value; this.events = []; }
  setValueAtTime(value, at) { this.events.push(['set', value, at]); this.value = value; }
  linearRampToValueAtTime(value, at) { this.events.push(['linear', value, at]); }
  exponentialRampToValueAtTime(value, at) { this.events.push(['exponential', value, at]); }
  cancelAndHoldAtTime(at) { this.events.push(['hold', at]); }
  cancelScheduledValues(at) { this.events.push(['cancel', at]); }
}
class Node {
  constructor(ctx, type) { this.ctx = ctx; this.type = type; this.gain = new Param(); this.frequency = new Param(); this.links = []; ctx.nodes.push(this); }
  connect(other) { this.links.push(other); return other; }
  disconnect() { assert.equal(this.dead, undefined, 'un nodo viene rilasciato una volta'); this.dead = true; }
  start(at) { this.startAt = at; }
  stop(at) { this.stopAt = at; }
}
class Context {
  constructor() { this.currentTime = 0; this.state = 'running'; this.nodes = []; }
  createGain() { return new Node(this, 'gain'); }
  createOscillator() { return new Node(this, 'oscillator'); }
  advance(at) {
    this.currentTime = at;
    for (const n of this.nodes) if (n.stopAt <= at && !n.ended) { n.ended = true; n.onended?.(); }
  }
}
(async () => {
  const { createMemoryMotif } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const ctx = new Context(); let allowed = false;
  const score = createMemoryMotif(ctx, {}, () => allowed);
  assert.equal(ctx.nodes.length, 0, 'nessun nodo creato dal costruttore');
  assert.equal(score.play('portal'), null); allowed = true;
  ctx.state = 'suspended'; assert.equal(score.play('portal'), null); ctx.state = 'running';
  for (const [cue, options] of [['missing'], ['portal', { level: NaN }], ['portal', { level: 0 }]]) assert.equal(score.play(cue, options), null);
  assert.equal(ctx.nodes.length, 0, 'nessuna allocazione durante silenzio, pausa o richieste invalide');
  const first = score.play('portal'); assert.ok(first && score.active);
  assert.equal(ctx.nodes.length, 7); assert.equal(ctx.nodes.filter(n => n.startAt !== undefined).length, 3);
  const firstNotes = ctx.nodes.filter(n => n.startAt !== undefined);
  const frequencies = firstNotes.map(n => n.frequency.events[0][1]);
  assert.ok(Math.abs(frequencies[1] / frequencies[0] - Math.pow(2, -1/12)) < 1e-9);
  assert.ok(Math.abs(frequencies[2] / frequencies[0] - Math.pow(2, -7/12)) < 1e-9);
  assert.ok(firstNotes[1].startAt - firstNotes[0].startAt !== firstNotes[2].startAt - firstNotes[1].startAt, 'spaziatura non da notifica');
  for (const gain of ctx.nodes.filter(n => n.type === 'gain' && n !== ctx.nodes[0])) {
    assert.ok(gain.gain.events.some(e => e[0] === 'linear' && e[2] - gain.gain.events[0][2] >= .5 && e[1] > 0), 'attacco morbido');
    assert.equal(gain.gain.events.at(-1)[1], 0, 'ogni nota torna esattamente a zero');
  }
  assert.equal(score.play('fracture'), null, 'al massimo una cellula, tre voci');
  assert.equal(ctx.nodes.length, 7);
  ctx.advance(.4); first.stop(); first.stop();
  assert.ok(firstNotes.slice(1).every(n => n.stopAt < n.startAt), 'le note future vengono annullate');
  ctx.advance(.6); assert.equal(score.active, false); assert.ok(ctx.nodes.every(n => n.dead), 'tutti i nodi rilasciati');
  ctx.advance(10); assert.equal(score.play('fracture'), null, 'intervallo globale fra richiami');
  ctx.advance(21); assert.equal(score.play('portal'), null, 'il key accettato resta deduplicato');
  allowed = false; assert.equal(score.play('sister', { key: 'sister-window' }), null); allowed = true;
  assert.ok(score.play('sister', { key: 'sister-window', level: 99 }), 'un gate non consuma il key');
  const gains = ctx.nodes.slice(7).filter(n => n.type === 'gain');
  assert.ok(Math.max(...gains.flatMap(n => n.gain.events.filter(e => e[0] === 'linear').map(e => e[1]))) <= .0075, 'level non puo aumentare il volume');
  ctx.advance(22); score.block(24); ctx.advance(41.1); assert.equal(score.play('agnese'), null, 'crescendo ancora protetto anche a cellula finita');
  ctx.advance(46.1); assert.ok(score.play('agnese')); ctx.advance(53); assert.ok(ctx.nodes.every(n => n.dead), 'cleanup naturale');
  score.reset(); assert.ok(score.play('portal'), 'nuova partita ripulisce dedup e cooldown');
  ctx.advance(53.05); score.stop(); ctx.advance(53.1); score.stop(0); ctx.advance(53.1);
  assert.ok(ctx.nodes.every(n => n.dead), 'pausa/cut troncano anche un fade gia iniziato, senza sorgenti future');

  let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let rendered;
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    rendered = await page.evaluate(async ({ source, preview }) => {
      const { createMemoryMotif } = await import('data:text/javascript;base64,' + source);
      const variants = [];
      for (const cue of ['portal', 'fracture', 'bridge', 'sister', 'agnese', 'cancelled']) {
        const rate = 24000, offline = new OfflineAudioContext(1, rate * 8, rate), nodes = [], disconnected = new Set();
        // Lo stato offline e' inizialmente suspended; la facciata consente di
        // pianificare prima del render senza falsificare nessun nodo Web Audio.
        const ctx = { get currentTime() { return offline.currentTime; }, state: 'running' };
        for (const method of ['createGain', 'createOscillator']) ctx[method] = () => {
          const n = offline[method](), disconnect = n.disconnect.bind(n); nodes.push(n);
          n.disconnect = (...args) => { disconnected.add(n); return disconnect(...args); }; return n;
        };
        const score = createMemoryMotif(ctx, offline.destination), handle = score.play(cue === 'cancelled' ? 'portal' : cue);
        const pending = cue === 'cancelled' ? offline.suspend(.9).then(() => { score.stop(); return offline.resume(); }) : null;
        const buffer = await offline.startRendering(); if (pending) await pending;
        const samples = buffer.getChannelData(0); let peak = 0, sum = 0;
        for (const sample of samples) { if (!Number.isFinite(sample)) throw Error('campione non finito'); peak = Math.max(peak, Math.abs(sample)); sum += sample*sample; }
        const energy = (from, to) => { let s = 0; for(let i=Math.ceil(from*rate);i<Math.floor(to*rate);i++)s+=samples[i]*samples[i]; return Math.sqrt(s/((to-from)*rate)); };
        const metrics = { cue, peak, rms: Math.sqrt(sum/samples.length), duration: handle.duration, before: energy(0,.015), tail: energy(cue === 'cancelled' ? 1.1 : 7,7.9), made:nodes.length, released:disconnected.size };
        let wav = null;
        if (preview && cue === 'portal') {
          const bytes = new ArrayBuffer(44 + buffer.length * 2), view = new DataView(bytes), text = (at,s) => { for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i)); };
          text(0,'RIFF'); view.setUint32(4,bytes.byteLength-8,true); text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.length*2,true);
          for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,samples[i]*32767,true);
          const raw=new Uint8Array(bytes),parts=[];for(let i=0;i<raw.length;i+=16384)parts.push(String.fromCharCode(...raw.subarray(i,i+16384)));wav=btoa(parts.join(''));
        }
        variants.push({metrics,wav});
      }
      return variants;
    }, { source: Buffer.from(source).toString('base64'), preview: !!process.argv[2] });
    assert.deepEqual(errors, []);
    for (const { metrics: m } of rendered) {
      assert.ok(m.peak > .001 && m.peak < .016, 'motivo basso, finito e senza clipping');
      assert.equal(m.before, 0); assert.equal(m.tail, 0, 'zero coda, anche cancellando prima della seconda nota');
      assert.equal(m.made, 7); assert.equal(m.released, 7, 'nessun nodo residuo nel rendering nativo');
      assert.ok(m.duration > 5 && m.duration < 7);
    }
    if(process.argv[2])fs.writeFileSync(process.argv[2], Buffer.from(rendered[0].wav,'base64'));
  } finally { await browser.close(); }
  console.log(JSON.stringify({ result:'PASS', contract:'unlock/silence, 3 notes, 3 voice bound, gate retry, dedup, cooldown, crescendo priority, cancel/reset/cleanup', rendering:rendered.map(r => r.metrics) }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
