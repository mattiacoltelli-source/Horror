import * as THREE from 'three';
let surface;
function steelSurface(){
  if(surface)return surface;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const g=canvas.getContext('2d');
  const rough=document.createElement('canvas');rough.width=256;rough.height=512;const r=rough.getContext('2d');
  let seed=4501;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  g.fillStyle='#929990';g.fillRect(0,0,256,512);r.fillStyle='#c4c4c4';r.fillRect(0,0,256,512);
  for(let i=0;i<1000;i++){
    const x=random()*256,y=random()*512,len=8+random()*110;
    g.strokeStyle=i%3?'rgba(40,47,42,.035)':'rgba(225,223,203,.09)';g.lineWidth=.4+random()*.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+(random()-.5)*2,y+len);g.stroke();
  }
  for(let i=0;i<62;i++){
    const x=random()*256,y=random()*512,len=3+random()*42,dx=(random()-.5)*30;
    for(const [ctx,color]of [[g,'rgba(213,211,189,.23)'],[r,'rgba(245,245,245,.32)']]){ctx.strokeStyle=color;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+len);ctx.stroke();}
  }
  for(let i=0;i<15;i++){
    const x=random()*256,y=random()*512,rad=10+random()*27;
    for(const [ctx,color]of [[g,'rgba(48,43,29,.17)'],[r,'rgba(75,75,75,.24)']]){const gr=ctx.createRadialGradient(x,y,1,x,y,rad);gr.addColorStop(0,color);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);}
  }
  for(const [x,y,rad]of [[73,356,26],[188,101,17]]){
    g.strokeStyle='rgba(55,47,30,.16)';g.lineWidth=2.3;g.beginPath();g.ellipse(x,y,rad,rad*1.4,.25,.2,4.7);g.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const roughnessMap=new THREE.CanvasTexture(rough);
  surface=new THREE.MeshStandardMaterial({map,roughnessMap,color:0xb3b5b0,metalness:.65,roughness:.88,envMapIntensity:.55});return surface;
}
export function createWornTableTop(){
  const w=.344,d=.744,r=.018,s=new THREE.Shape();
  s.moveTo(-w+r,-d);s.lineTo(w-r,-d);s.quadraticCurveTo(w,-d,w,-d+r);s.lineTo(w,d-r);s.quadraticCurveTo(w,d,w-r,d);s.lineTo(-w+r,d);s.quadraticCurveTo(-w,d,-w,d-r);s.lineTo(-w,-d+r);s.quadraticCurveTo(-w,-d,-w+r,-d);
  const geo=new THREE.ExtrudeGeometry(s,{depth:.028,steps:1,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,curveSegments:3});geo.rotateX(-Math.PI/2);geo.translate(0,.886,0);
  const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+.35)/.7,(p.getZ(i)+.75)/1.5);
  const mesh=new THREE.Mesh(geo,steelSurface());mesh.name='piano-acciaio-consumato';return mesh;
}
