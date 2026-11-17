// node --experimental-vm-modules tools/check_personal_photos.cjs
// Nessuna foto di ripiego: ogni profilo ha solo la propria, oppure nessuna.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/personal.js'),'utf8');
 for(const [query,file] of [['',''],['?per=elisa','pic_elisa_altar_burnt.webp'],['?per=ELISA','pic_elisa_altar_burnt.webp'],['?per=yana','pic_yana.jpg'],['?per=alice','pic_alice.jpg'],['?per=rebecca','pic_rebecca.jpg'],['?per=laya','pic_laya.jpg'],['?per=steve','pic_steve.jpg'],['?per=tommy',''],['?per=gabriele',''],['?per=marco&g=m',''],['?per=%3Cbad%3E','']]){
  const context=vm.createContext({URLSearchParams,location:{search:query}}),mod=new vm.SourceTextModule(source,{context});
  await mod.link(()=>{throw Error('Unexpected import');});await mod.evaluate();const p=mod.namespace.ALTAR_PHOTO;
  assert.equal(p?.file||'',file,query||'standard');
  if(p){assert.ok(p.aspect>0&&Number.isFinite(p.aspect));assert.ok(fs.existsSync(path.join(root,'assets/tex',p.file)));}
 }
 console.log('Foto personali: sei profili, standard, nomi senza foto e input non validi verificati.');
})().catch(e=>{console.error(e);process.exit(1);});
