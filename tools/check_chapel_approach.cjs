// node tools/check_chapel_approach.cjs
// Percorso reale della cripta, senza GPU: ingresso, pareti, altare e ritorno.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/player/chapel-approach.js'), 'utf8');
const factory = new Function(source.replace('export function', 'function') + '; return createChapelApproach;')();
const bounds = [-3.5,3.5,-222.6,-200.6], zc = -215.5;
const move = factory({ wallX:4, altarFrontX:5.9, zc, depth:3 });
const pos = { x:3.4, z:zc }, clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const step = (dx,dz) => {
  const x=pos.x+dx, z=pos.z+dz;
  const result=move(x,z,bounds,pos) ?? [clamp(x,bounds[0],bounds[1]),clamp(z,bounds[2],bounds[3])];
  pos.x=result[0];pos.z=result[1];
};
for(let i=0;i<70;i++)step(.05,0);
assert.ok(Math.abs(pos.x-5.58)<1e-8,'Si arriva ai gradini, oltre la vecchia soglia');
for(let i=0;i<200;i++)step(.05,.03);
assert.ok(pos.x<=5.580001&&Math.abs(pos.z-zc)<=1.180001,'Altare e pareti non si attraversano');
pos.x=5.5;pos.z=zc;
for(let i=0;i<50;i++)step(-.05,0);
assert.ok(pos.x<3.5,'Ritorno nella cantina senza blocchi');
for(const offset of [-1.4,-.7,.7,1.4]) {
  pos.x=3.5;pos.z=zc+offset;for(let i=0;i<20;i++)step(.05,0);
  assert.equal(pos.x,3.5,'Nessun passaggio attraverso la parete accanto all’arco');
}
for(const offset of [-.65,0,.65]) {
  pos.x=3.4;pos.z=zc+offset;for(let i=0;i<70;i++)step(.05,0);
  assert.ok(pos.x>5.5,'L’arco resta abbastanza largo');
}
pos.x=5.5;pos.z=zc+1.1;
for(let i=0;i<35;i++)step(-.05,0);
assert.ok(pos.x>=4.32,'La spalla dell’arco blocca l’uscita laterale');
for(let i=0;i<22;i++)step(0,-.05);
for(let i=0;i<40;i++)step(-.05,0);
assert.ok(pos.x<3.5,'Rientrare al centro libera l’uscita');
assert.equal(move(5.1,-210.8,bounds,{x:5,z:-210.8}),null,'Il santuario dei film mantiene il proprio controllo');
console.log('Cripta: ingresso, avvicinamento, pareti, ritorno e separazione dal santuario verificati.');
