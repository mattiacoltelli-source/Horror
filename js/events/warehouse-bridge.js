// A real opening in the warehouse floor; the player stays on a solid strip.
import * as THREE from 'three';
import { partitionBridgeSurface,createAbyssBridgeGeometry } from '../world/abyss-bridge.js';

const smooth=v=>{const u=Math.max(0,Math.min(1,v));return u*u*u*(10+u*(-15+6*u));};
export function createWarehouseBridge({group,room,mats,player,audio,lights,renderer,z0,width,reduced=false,narrationBusy=()=>false}){
  const config={start:z0-8.5,end:z0-15.5,halfWidth:1.05,depth:8},radius=.32,limit=config.halfWidth-radius;
  const B={state:'idle',time:0,roomTime:0,left:0,right:0,done:false,config};
  const surfaces=new Map(),props=[],seen=new WeakSet(),box=new THREE.Box3(),inverse=new THREE.Matrix4();
  const textures=new Set(),uploaded=new WeakMap();
  const collectTextures=object=>object.traverse(o=>{for(const m of [].concat(o.material||[])){
    for(const t of Object.values(m))if(t?.isTexture)textures.add(t);
    for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);
  }});
  const pit=createAbyssBridgeGeometry({...config,mats,width});group.add(pit);
  collectTextures(room.group);collectTextures(pit);
  let previous=null,installed=false,lastLeft=-1,lastRight=-1,pitLamp=null;
  const active=()=>group.visible&&!B.done;
  const valid=(x,z)=>!(B.left>.002||B.right>.002)||z>config.start+radius||z<config.end-radius||Math.abs(x)<=limit;
  const move=(x,z)=>{
    if(!active())return null;
    const bounds=player.box;if(!bounds)return null;
    let xx=THREE.MathUtils.clamp(x,bounds[0],bounds[1]),zz=player.pos.z;
    if(!valid(xx,zz))xx=player.pos.x;
    zz=THREE.MathUtils.clamp(z,bounds[2],bounds[3]);if(!valid(xx,zz))zz=player.pos.z;
    return[xx,zz];
  };
  const release=()=>{if(installed&&player.constrainMove===move)player.constrainMove=previous;installed=false;previous=null;};
  function surface(mesh){
    const old=surfaces.get(mesh);if(old?.geometry===mesh.geometry)return;
    mesh.updateWorldMatrix(true,false);mesh.parent.updateWorldMatrix(true,false);
    const matrix=new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert().multiply(mesh.matrixWorld);
    const source=mesh.geometry,data=partitionBridgeSurface(source,config,matrix);
    mesh.geometry=data.geometry;source.dispose();mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);mesh.updateMatrix();
    surfaces.set(mesh,data);lastLeft=lastRight=-1;
  }
  const floor=room.group.children.find(o=>o.material===mats.floorB);surface(floor);
  function scan(){
    group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();
    for(const object of group.children){
      if(object===room.group||object===pit)continue;
      if(surfaces.has(object)){if(surfaces.get(object).geometry!==object.geometry)surface(object);continue;}
      if(seen.has(object))continue;
      collectTextures(object);
      if(object.isLight||object.isSprite||object.isPoints){seen.add(object);continue;}
      let skinned=false;object.traverse(o=>{if(o.isSkinnedMesh)skinned=true;});if(skinned){seen.add(object);continue;}
      object.updateWorldMatrix(true,true);box.setFromObject(object).applyMatrix4(inverse);if(box.isEmpty())continue;
      seen.add(object);
      if(box.max.z<config.end||box.min.z>config.start)continue;
      const height=box.max.y-box.min.y;
      if(object.isMesh&&height<.045&&box.min.y>-.03&&box.max.y<.05){surface(object);continue;}
      const x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2;
      const supported=object.userData.supportHeight!=null?object.userData.supportHeight<2:box.min.y<.15;
      if(!supported||box.max.y>3||Math.abs(x)<config.halfWidth+.15||z>=config.start||z<=config.end)continue;
      if(object.isMesh&&Math.min(box.max.x-box.min.x,box.max.z-box.min.z)<.035)continue;
      const anchors=new Set();object.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.userData?.ageFloor)anchors.add(m.userData.ageFloor);});
      props.push({object,y:object.position.y,side:x<0?-1:1,anchors:[...anchors]});lastLeft=lastRight=-1;
    }
    // Pre-upload while approaching, including maps that finished loading after
    // the room's initial preparation. No image requests or new textures here.
    if(renderer)for(const t of textures){
      if(t.isVideoTexture||t.isRenderTargetTexture||t.isCubeTexture){textures.delete(t);continue;}
      if(!t.image||t.image.complete===false)continue;
      if(uploaded.get(t)!==t.version){renderer.initTexture(t);uploaded.set(t,t.version);}textures.delete(t);
    }
  }
  function apply(){
    if(lastLeft===B.left&&lastRight===B.right)return;
    for(const data of surfaces.values()){
      const p=data.geometry.attributes.position;
      for(let i=0;i<p.count;i++)p.array[i*3+1]=data.restY[i]-(data.tags[i]<0?B.left:data.tags[i]>0?B.right:0);
      p.needsUpdate=true;
    }
    for(const p of props){const depth=p.side<0?B.left:B.right;p.object.position.y=p.y-depth;for(const anchor of p.anchors)anchor.value=depth?-depth:0;}
    const depth=Math.max(B.left,B.right);
    if(depth>.025&&!pitLamp&&lights){pitLamp=lights.addLamp(-2,-3.1,(config.start+config.end)/2,0x698ba1);pitLamp.mode='dim';}
    if(pitLamp){pitLamp.base=1.4*smooth(depth/2);if(depth<=.025){lights.dropLamp(pitLamp);pitLamp=null;}}
    lastLeft=B.left;lastRight=B.right;
  }
  Object.defineProperties(B,{
    busy:{get:()=>!B.done&&B.state!=='idle'},holdNarration:{get:()=>B.busy||(!B.done&&B.roomTime<12)},ownsController:{get:()=>player.constrainMove===move},
    stats:{get:()=>({surfaces:surfaces.size,props:props.length,vertices:[...surfaces.values()].reduce((n,s)=>n+s.restY.length,0),pitTriangles:pit.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)})},
  });
  B.reset=()=>{
    release();B.state='idle';B.time=B.roomTime=B.left=B.right=0;B.done=false;scan();lastLeft=lastRight=-1;apply();
    previous=player.constrainMove??null;player.constrainMove=move;installed=true;
  };
  B.leave=()=>{release();B.left=B.right=0;lastLeft=lastRight=-1;apply();B.done=true;B.state='done';};
  B.update=(dt,enabled)=>{
    if(!enabled){if(installed)B.leave();return;}
    if(B.done)return;
    scan();B.roomTime+=dt;
    const p=player.pos;
    if(B.state==='idle'){
      if(p.z<config.end-1){B.done=true;B.state='done';release();return;}
      if(p.z<z0-6.2&&p.z>config.end-.1&&Math.abs(p.x)<limit-.12&&!narrationBusy()){
        B.state='opening';B.time=0;audio.swell?.(reduced?6:4,.30);audio.squeak?.(1.8,new THREE.Vector3(-4,0,config.start-1));
      }
    }
    const duration=reduced?7:4.6;
    if(B.state==='opening'){
      B.time+=dt;B.left=config.depth*smooth(B.time/(duration-.3));B.right=config.depth*smooth((B.time-.3)/(duration-.3));
      if(B.time>=duration){B.state='open';B.time=0;}
    }else if(B.state==='open'){
      B.time+=dt;
      if(B.time>.8&&(p.z<config.end-.7||p.z>config.start+2.9)){B.state='restoring';B.time=0;audio.swell?.(3,.16);}
    }else if(B.state==='restoring'){
      B.time+=dt;B.left=B.right=config.depth*(1-smooth(B.time/(reduced?5.5:3.6)));
      if(B.time>=(reduced?5.5:3.6)){B.left=B.right=0;B.done=true;B.state='done';release();}
    }
    apply();
  };
  B.scan=scan;B.group=pit;return B;
}
