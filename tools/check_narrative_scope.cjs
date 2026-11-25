// node tools/check_narrative_scope.cjs [--pwa]
// Strict scope guard against the production revision from which this feature started.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), baseline = 'b4e88caa95926ed7f5d2f87ce25f400b7b85ae67';
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const protectedPaths = ['js/world/', 'assets/', 'vendor/', 'css/', 'js/player/', 'js/render/', 'js/pwa.js', 'manifest.webmanifest', 'icons/', 'labs/'];
// Subsequent explicit request: replace the old encounter and mural. Every
// other visual asset/room/controller remains covered by the original guard.
const drainChanges = new Set(['js/world/painted-mural.js', 'assets/tex/pic_mural_infernal_smoke.webp',
  'assets/models/hound.glb', 'assets/audio/hound_breath.mp3', 'assets/tex/pic_mural_dog.webp', 'css/style.css']);
const protectedFile = file => !drainChanges.has(file) && protectedPaths.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix);
const changed = git('diff', '--name-only', baseline, '--').split('\n').filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
assert.deepEqual([...new Set([...changed, ...untracked].filter(protectedFile))], [], 'visuals, controls, performance renderer, assets, PWA behavior and disabled laboratories remain byte-identical');
// Three loader sentences may change; every other HTML byte, including scripts,
// layout, styles and personalized profile structure, must stay identical.
const normalizeLoader = source => {
  source = source.replace('    <p class="credits">cane: Grimhound Rig, DM-913 (CC-BY 4.0)</p>\n', '');
  source = source.replace(/    <div id="room-picker"[\s\S]*?\n    <\/div>\n/, '    <!-- shared room picker -->\n');
  source = source.replace(/    <button id="ckpt"[^\n]*\n    <div id="cmenu"[^\n]*\n/, '    <!-- shared room picker -->\n');
  for (const [profile, index] of [['yana', 2], ['alice', 1], ['laya', 1]]) {
    const array = new RegExp('\\b' + profile + ': \\[[^\\]\\n]*\\]').exec(source);
    assert.ok(array, profile + ' loader entry');
    const strings = [...array[0].matchAll(/'(?:\\.|[^'\\])*'/g)];
    const token = strings[index]; assert.ok(token, profile + ' sentence');
    const offset = array.index + token.index;
    source = source.slice(0, offset) + "'__narrative_copy__'" + source.slice(offset + token[0].length);
  }
  return source;
};
assert.equal(normalizeLoader(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), normalizeLoader(git('show', baseline + ':index.html') + '\n'), 'only approved loader/credit copy and the shared room picker change in index.html');
const normalizeMenuCss = source => {
  const from = source.includes('/* selettore ambienti:') ? source.indexOf('/* selettore ambienti:') : source.indexOf("/* menu 'riparti da");
  const to = source.indexOf("/* schermata 'come ti chiami", from);
  assert.ok(from >= 0 && to > from, 'bounded room-menu stylesheet section');
  return source.slice(0, from) + '/* room menu */\n' + source.slice(to);
};
assert.equal(normalizeMenuCss(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')), normalizeMenuCss(git('show', baseline + ':css/style.css') + '\n'), 'all in-game controls and styles outside the initial room picker remain unchanged');
const notes = fs.readFileSync(path.join(root, 'js/events/notes.js'), 'utf8');
const oldNotes = git('show', baseline + ':js/events/notes.js');
const paper = s => s.slice(s.indexOf('let tex = null;'), s.indexOf('// def:'));
assert.equal(paper(notes), paper(oldNotes), 'paper/glint textures and materials are unchanged');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(main.includes("q.get('allunga') === '1'"), 'experimental tunnel stretch remains opt-in');
assert.ok(fs.readFileSync(path.join(root, 'js/events/warehouse.js'), 'utf8').includes("get('ponte')==='0'"), 'bridge disable flag is preserved');
assert.ok(fs.readFileSync(path.join(root, 'js/events/ward.js'), 'utf8').includes("get('piega') !== '0'"), 'ward deformation disable flag is preserved');

if (process.argv.includes('--pwa')) {
  const files = name => {
    const list = [];
    const walk = relative => { const absolute = path.join(root, relative); const st = fs.statSync(absolute); if (st.isFile()) list.push(relative); else for (const child of fs.readdirSync(absolute)) walk(path.posix.join(relative, child)); };
    for (const entry of name) walk(entry);
    return list.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  };
  const shell = files(['index.html', 'manifest.webmanifest', 'css', 'js', 'vendor', 'icons']);
  const assets = files(['assets']);
  const hash = list => crypto.createHash('sha1').update(list.map(file => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, file))).digest('hex') + '  ' + file + '\n').join('')).digest('hex').slice(0, 10);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), oldSw = git('show', baseline + ':sw.js');
  const version = (s, kind) => s.match(new RegExp("const " + kind + "_VERSION = '([^']+)'"))[1];
  const list = kind => new Function('return ' + sw.match(new RegExp('const ' + kind + '_FILES = (\\[.*?\\]);'))[1])();
  assert.equal(version(sw, 'SHELL'), hash(shell), 'run tools/bump.sh after the final runtime edit');
  assert.equal(version(sw, 'ASSET'), hash(assets));
  if (!changed.some(file => file.startsWith('assets/') && drainChanges.has(file)))
    assert.equal(version(sw, 'ASSET'), version(oldSw, 'ASSET'), 'narrative-only changes do not invalidate heavy asset cache');
  assert.deepEqual(list('SHELL'), ['./', ...shell.map(file => './' + file)]);
  assert.deepEqual(list('ASSET'), assets.map(file => './' + file));
  for (const module of ['js/narration.js', 'js/narrative-copy.js', 'js/narrative-director.js', 'js/audio/motif.js', 'js/events/drain-presence.js', 'js/world/painted-mural.js']) assert.ok(list('SHELL').includes('./' + module), module + ' is available offline');
}
console.log(JSON.stringify({ result: 'PASS', baseline: baseline.slice(0, 8), protectedPaths, pwaChecked: process.argv.includes('--pwa') }, null, 2));
