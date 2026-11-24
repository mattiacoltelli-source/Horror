// Partition existing flat surfaces into a stable path and two descending wings.
// UVs, normals and colours are interpolated once; only Y changes during motion.
import * as THREE from 'three';
import { Builder, gray } from './tunnel.js';

export function partitionBridgeSurface(source,{start,end,halfWidth,depth},matrix=null){
  const input=source.clone();if(matrix)input.applyMatrix4(matrix);
  const names=['position',...Object.keys(input.attributes).filter(n=>n!=='position')],sizes=names.map(n=>input.attributes[n].itemSize);
  const stride=sizes.reduce((a,b)=>a+b,0),arrays=names.map(()=>[]),tags=[],restY=[];
  const vertex=i=>{const out=[];for(const name of names){const a=input.attributes[name];for(let c=0;c<a.itemSize;c++)out.push(a.getComponent(i,c));}return out;};
  const clip=(poly,axis,bound,sign)=>{
    const out=[];if(!poly.length)return out;
    let a=poly[poly.length-1],da=(a[axis]-bound)*sign;
    for(const b of poly){const db=(b[axis]-bound)*sign;
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
      if(db>=0)out.push(b);a=b;da=db;
    }return out;
  };
  const emit=(poly,tag)=>{
    for(let i=1;i<poly.length-1;i++){
      const tri=[poly[0],poly[i],poly[i+1]],a=tri[0],b=tri[1],c=tri[2];
      if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<1e-10)continue;
      for(const v of tri){let offset=0;for(let n=0;n<names.length;n++){arrays[n].push(...v.slice(offset,offset+sizes[n]));offset+=sizes[n];}tags.push(tag);restY.push(v[1]);}
    }
  };
  const count=input.index?.count??input.attributes.position.count;
  for(let i=0;i<count;i+=3){
    const tri=[0,1,2].map(j=>vertex(input.index?input.index.getX(i+j):i+j));
    emit(clip(tri,2,start,1),0);emit(clip(tri,2,end,-1),0);
    const middle=clip(clip(tri,2,start,-1),2,end,1);
    emit(clip(middle,0,-halfWidth,-1),-1);
    emit(clip(clip(middle,0,-halfWidth,1),0,halfWidth,-1),0);
    emit(clip(middle,0,halfWidth,1),1);
  }
  const geometry=new THREE.BufferGeometry();
  names.forEach((name,i)=>geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[i],sizes[i],input.attributes[name].normalized)));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.computeBoundingBox();
  geometry.boundingBox.min.y-=depth;geometry.boundingSphere=new THREE.Sphere();geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  input.dispose();
  return{geometry,tags:new Int8Array(tags),restY:new Float32Array(restY)};
}

export function createAbyssBridgeGeometry({mats,width,start,end,halfWidth,depth}){
  const b=new Builder(),material=new THREE.MeshLambertMaterial({map:mats.floorB.map,vertexColors:true});
  const quad=(points,normal)=>b.quad('edge',points,points.map(p=>normal[1]?[p[0]/1.6,p[2]/1.6]:[p[normal[0]?2:0]/1.6,p[1]/1.6]),points.map(p=>gray(.12+.32*Math.max(0,1+p[1]/depth))),normal);
  const top=-.006,bottom=-depth-.08,xl=-width/2,xr=width/2,t=.22;
  for(const[x,n]of[[xl,1],[xr,-1]])quad([[x,bottom,start],[x,bottom,end],[x,top,end],[x,top,start]],[n,0,0]);
  for(const[z,n]of[[start,-1],[end,1]])for(const[a,c]of[[xl,-halfWidth],[halfWidth,xr]])quad([[a,bottom,z],[c,bottom,z],[c,top,z],[a,top,z]],[0,0,n]);
  for(const[x,n]of[[-halfWidth,-1],[halfWidth,1]])quad([[x,-t,start],[x,-t,end],[x,top,end],[x,top,start]],[n,0,0]);
  quad([[-halfWidth,-t,start],[halfWidth,-t,start],[halfWidth,-t,end],[-halfWidth,-t,end]],[0,-1,0]);
  // Dim, static fixtures explain the cold fill below the opening. Both share
  // one unlit draw; their light is borrowed from the existing two-light pool.
  for(const[x,z,n]of[[xl+.02,start-2.2,1],[xr-.02,end+1.8,-1]]){
    b.quad('lamp',[[x,-3.18,z-.18],[x,-3.18,z+.18],[x,-3.05,z+.18],[x,-3.05,z-.18]],[[0,0],[1,0],[1,1],[0,1]],[gray(1),gray(1),gray(1),gray(1)],[n,0,0]);
  }
  const group=b.build({edge:material,lamp:new THREE.MeshBasicMaterial({color:0x455e73,toneMapped:false,vertexColors:true})});group.name='pozzo-sotto-il-ponte';return group;
}
