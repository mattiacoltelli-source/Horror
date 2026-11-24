// Partition existing flat surfaces into a stable path and two descending wings.
// UVs, normals and colours are interpolated once; only Y changes during motion.
import * as THREE from 'three';
import { Builder, gray } from './tunnel.js';
import { createAbyssPresence } from './abyss-presence.js';

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
  geometry.setAttribute('bridgeWing',new THREE.Float32BufferAttribute(tags,1));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.computeBoundingBox();
  geometry.boundingBox.min.y-=depth;geometry.boundingSphere=new THREE.Sphere();geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  input.dispose();
  return{geometry,tags:new Int8Array(tags),restY:new Float32Array(restY)};
}

export function createAbyssBridgeGeometry({mats,width,start,end,halfWidth,depth,reduced=false}){
  const b=new Builder(),material=new THREE.MeshBasicMaterial({map:mats.floorB.map,vertexColors:true,fog:false,toneMapped:false});
  const quad=(points,normal)=>b.quad('edge',points,points.map(p=>normal[1]?[p[0]/1.6,p[2]/1.6]:[p[normal[0]?2:0]/1.6,p[1]/1.6]),points.map(p=>gray(.012+.012*Math.max(0,1+p[1]/t))),normal);
  // Only a dark masonry lip remains. Deep rectangular walls would obscure the
  // stars and make this read as a basement shaft rather than impossible space.
  const top=0,t=.22,bottom=-t,xl=-width/2,xr=width/2;
  for(const[x,n]of[[xl,1],[xr,-1]])quad([[x,bottom,start],[x,bottom,end],[x,top,end],[x,top,start]],[n,0,0]);
  for(const[z,n]of[[start,-1],[end,1]])for(const[a,c]of[[xl,-halfWidth],[halfWidth,xr]])quad([[a,bottom,z],[c,bottom,z],[c,top,z],[a,top,z]],[0,0,n]);
  for(const[x,n]of[[-halfWidth,-1],[halfWidth,1]])quad([[x,-t,start],[x,-t,end],[x,top,end],[x,top,start]],[n,0,0]);
  quad([[-halfWidth,-t,start],[halfWidth,-t,start],[halfWidth,-t,end],[-halfWidth,-t,end]],[0,-1,0]);
  const group=b.build({edge:material});group.name='pozzo-sotto-il-ponte';
  let seed=1793;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),positions=[],colors=[];
  const count=globalThis.__lowQ?350:700;
  for(let i=0;i<count;i++){
    const az=random()*Math.PI*2,ny=-.15-.85*random(),r=Math.sqrt(1-ny*ny),radius=14+14*random();
    positions.push(radius*r*Math.cos(az),-.9+radius*ny,radius*r*Math.sin(az));
    const light=.22+.68*Math.pow(random(),3),violet=i%7===0;
    colors.push(light*(violet?.85:.65),light*(violet?.56:.77),light);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const stars=new THREE.Points(geometry,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));stars.name='abisso-stelle';group.add(stars);
  const presence=createAbyssPresence({z:(start+end)/2,reduced});group.add(presence.mesh);
  group.userData.ready=presence.ready;group.userData.presence=presence;
  stars.position.z=(start+end)/2;let time=0;
  group.userData.setDepth=d=>{
    const u=Math.min(1,Math.max(0,d/5.2));stars.material.opacity=.85*u*u*(3-2*u);
    presence.setOpenness(u*u*(3-2*u));
    if(u===0){time=0;stars.rotation.y=0;stars.material.color.setScalar(1);}
  };
  // Only one transform and one colour uniform change. Vertex buffers stay
  // static, with the pivot centred under the bridge rather than at world zero.
  group.userData.update=(dt,looking=false)=>{
    presence.update(dt,looking);
    if(reduced||stars.material.opacity===0)return;
    time+=dt;stars.rotation.y=time*.012%(Math.PI*2);
    stars.material.color.setScalar(.88+.10*Math.sin(time*.72)+.02*Math.sin(time*1.17+.5));
  };
  return group;
}
