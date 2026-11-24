// A distant nebular organism: one alpha cutout, one lightly segmented plane.
// Gaze starts its slow reveal; camera and player movement remain untouched.
import * as THREE from 'three';
import { ABYSS_PRESENCE_IMAGE } from './abyss-presence-image.js';

const smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
export function createAbyssPresence({z,reduced=false}){
  const status={loaded:false,error:null};let resolve;
  const ready=new Promise(r=>{resolve=r;});
  const map=new THREE.TextureLoader().load(ABYSS_PRESENCE_IMAGE,()=>{status.loaded=true;resolve(true);},undefined,()=>{status.error='presence texture';resolve(false);});
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=1;
  const uniforms={uPresenceTime:{value:0},uPresenceLife:{value:0}};
  const material=new THREE.MeshBasicMaterial({map,color:new THREE.Color(.55,.62,.85),transparent:true,opacity:0,alphaTest:.025,depthWrite:true,fog:false,toneMapped:false});
  material.uniforms=uniforms;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uPresenceTime,uPresenceLife;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        if(uPresenceLife>0.0){
          float tip=pow(abs(uv.x-.5)*2.0,1.5);
          transformed.z+=uPresenceLife*((sin(uPresenceTime*.21+uv.x*4.2)-sin(uv.x*4.2))*.7*tip+sin(uPresenceTime*.14+uv.y*2.0)*.18);
        }`);
  };
  material.customProgramCacheKey=()=> 'abyss-nebular-presence-v1';
  const geometry=new THREE.PlaneGeometry(32,32,12,8);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=1.8;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='abisso-presenza-nebulosa';mesh.position.set(-3.5,-18,z-.5);mesh.rotation.set(-Math.PI/2+.10,0,-.22,'YXZ');mesh.visible=false;
  let openness=0,age=0,observed=false;
  const reset=()=>{age=0;observed=false;uniforms.uPresenceTime.value=uniforms.uPresenceLife.value=0;mesh.position.y=-18;mesh.rotation.y=0;material.opacity=0;mesh.visible=false;};
  return{mesh,ready,status,uniforms,get age(){return age;},get observed(){return observed;},
    setOpenness(v){openness=v;if(v===0)reset();},
    update(dt,looking){
      if(!status.loaded||openness===0){mesh.visible=false;return;}
      mesh.visible=true;if(looking)observed=true;if(observed)age+=dt;
      const time=Math.max(0,age-4),life=reduced?0:smooth(4,14,age);
      material.opacity=openness*(.16+.5*smooth(.5,9,age));
      uniforms.uPresenceTime.value=reduced?0:time;uniforms.uPresenceLife.value=life;
      mesh.position.y=-18+life*.35*Math.sin(time*.16);mesh.rotation.y=life*.04*Math.sin(time*.10);
    },
  };
}
