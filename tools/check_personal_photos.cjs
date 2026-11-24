// node --experimental-vm-modules tools/check_personal_photos.cjs
// Nessuna foto di ripiego: ogni profilo ha solo la propria, oppure nessuna.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/personal.js'),'utf8');
 for(const [query,file] of [['',''],['?per=elisa','pic_elisa_altar_burnt.webp'],['?per=ELISA','pic_elisa_altar_burnt.webp'],['?per=yana','pic_yana.jpg'],['?per=alice','pic_alice.jpg'],['?per=rebecca','pic_rebecca.jpg'],['?per=laya','pic_laya.jpg'],['?per=steve','pic_steve.jpg'],['?per=mati','pic_mati_altar_burnt.webp'],['?per=matilde','pic_mati_altar_burnt.webp'],['?per=MATI','pic_mati_altar_burnt.webp'],['?per=tommy',''],['?per=gabriele',''],['?per=marco&g=m',''],['?per=%3Cbad%3E','']]){
  const context=vm.createContext({URLSearchParams,location:{search:query}}),mod=new vm.SourceTextModule(source,{context});
  await mod.link(()=>{throw Error('Unexpected import');});await mod.evaluate();const p=mod.namespace.ALTAR_PHOTO;
  assert.equal(p?.file||'',file,query||'standard');
  if(p){assert.ok(p.aspect>0&&Number.isFinite(p.aspect));assert.ok(fs.existsSync(path.join(root,'assets/tex',p.file)));}
  if(/per=(mati|matilde)$/i.test(query)){
   assert.equal(mod.namespace.P.name,'Matilde');assert.equal(mod.namespace.P.f,true);assert.equal(mod.namespace.P.hair,'biondi');
   assert.ok(mod.namespace.P.joke.includes('Mati'));assert.equal(mod.namespace.CITY,'Bologna');assert.equal(mod.namespace.BDAY,'');
   assert.equal(mod.namespace.PHOTO,file);assert.equal(p.baked,true);assert.equal(p.aspect,.8);
   const three=new vm.SyntheticModule([],function(){},{context}),tunnel=new vm.SyntheticModule(['W'],function(){this.setExport('W',1.4);},{context});
   const notes=new vm.SourceTextModule(fs.readFileSync(path.join(root,'js/events/notes.js'),'utf8'),{context});
   await notes.link(spec=>spec==='three'?three:spec==='../personal.js'?mod:tunnel);await notes.evaluate();
   const text=notes.namespace.NOTE_TEXT;assert.ok(text[0].includes('Matilde')&&text[0].includes('Mati')&&text[0].includes('Bologna'));
   assert.ok(text[3].includes('una sola sopravvissuta: Matilde'));assert.equal(text.filter(t=>t.includes('Bologna')).length,1);
  }
 }
 console.log('Foto personali: profili esistenti, Matilde/Mati, note al femminile, Bologna, standard e nomi senza foto verificati.');
})().catch(e=>{console.error(e);process.exit(1);});
