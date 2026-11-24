// A distant nebular organism: one alpha cutout, one lightly segmented plane.
// Its pose stays fixed in the stellar frame. Only its veils breathe, on the
// universe's clock; neither reveal nor orientation depends on the viewer.
import * as THREE from 'three';
import { ABYSS_PRESENCE_IMAGE } from './abyss-presence-image.js';

const smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
export function createAbyssPresence({z,reduced=false}){
  const status={loaded:false,error:null};let resolve;
  const ready=new Promise(r=>{resolve=r;});
  const map=new THREE.TextureLoader().load(ABYSS_PRESENCE_IMAGE,()=>{status.loaded=true;resolve(true);},undefined,()=>{status.error='presence texture';resolve(false);});
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=1;
  const uniforms={uPresenceTime:{value:0},uPresenceLife:{value:0},uFaceShadow:{value:.09}};
  const material=new THREE.MeshBasicMaterial({map,color:new THREE.Color(.55,.62,.85),transparent:true,opacity:0,alphaTest:.025,depthWrite:true,fog:false,toneMapped:false});
  material.uniforms=uniforms;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uPresenceTime,uPresenceLife;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        if(uPresenceLife>0.0){
          float tip=pow(abs(uv.x-.5)*2.0,1.5);
          transformed.z+=uPresenceLife*((sin(uPresenceTime*.21+uv.x*4.2)-sin(uv.x*4.2))*.4*tip+sin(uPresenceTime*.14+uv.y*2.0)*.10);
        }`);
    // Three blurred shadows reuse the existing albedo sample. Their broken
    // contrast follows the cloud's folds, without pupils, teeth or lit eyes.
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uFaceShadow;
      float nebulaShadow(vec2 p,vec2 r){p/=r;return 1.0-smoothstep(.20,1.60,dot(p,p));}`)
      .replace('#include <map_fragment>',`#include <map_fragment>
        #ifdef USE_MAP
          vec2 eyeL=vMapUv-vec2(.25,.46),eyeR=vMapUv-vec2(.36,.455),mouth=vMapUv-vec2(.305,.348);
          eyeL.y+=eyeL.x*.23;eyeR.y-=eyeR.x*.20;mouth.y+=mouth.x*.08-mouth.x*mouth.x*3.0;
          float face=max(nebulaShadow(eyeL,vec2(.045,.015))*.9,max(nebulaShadow(eyeR,vec2(.043,.014))*.8,nebulaShadow(mouth,vec2(.055,.018))*.65));
          float fold=.45+.55*smoothstep(.025,.18,dot(sampledDiffuseColor.rgb,vec3(.30,.59,.11)));
          diffuseColor.rgb*=1.0-uFaceShadow*face*fold;
        #endif`);
  };
  material.customProgramCacheKey=()=> 'abyss-nebular-presence-v2';
  const geometry=new THREE.PlaneGeometry(32,32,12,8);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=1.8;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='abisso-presenza-nebulosa';mesh.position.set(-3.5,-18,z-.5);mesh.rotation.set(-Math.PI/2+.10,0,-.22,'YXZ');mesh.visible=false;
  let openness=0,age=0;
  const reset=()=>{age=0;uniforms.uPresenceTime.value=uniforms.uPresenceLife.value=0;material.opacity=0;mesh.visible=false;};
  return{mesh,ready,status,uniforms,get age(){return age;},
    setOpenness(v){openness=v;if(v===0)reset();},
    update(dt){
      if(!status.loaded||openness===0){mesh.visible=false;return;}
      mesh.visible=true;age+=dt;
      const time=Math.max(0,age-4),life=reduced?0:smooth(4,14,age);
      material.opacity=openness*(.16+.5*smooth(.5,9,age));
      uniforms.uPresenceTime.value=reduced?0:time;uniforms.uPresenceLife.value=life;
    },
  };
}
