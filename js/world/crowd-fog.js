// Sparse smoke wisps overlap in a shallow volume, rather than flat rows of
// stretched stamps. One draw and the same alpha texture as the drain.
import * as THREE from 'three';
import { getMistTexture } from './mist-texture.js';

const ACTORS = 15;
export function createCrowdFog({ reduced = false, lowQuality = false } = {}) {
  const count = lowQuality ? 84 : 120, anchors = [], shapes = [], phases = [];
  let seed = 9127;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const halton = (index,base) => {let f=1,r=0;for(let n=index;n>0;n=Math.floor(n/base)){f/=base;r+=f*(n%base);}return r;};
  for (let i = 0; i < count; i++) {
    anchors.push(-5.1+halton(i+1,2)*10.2,.10+random()*.24,-55.2-halton(i+1,3)*31);
    shapes.push(1.65+random()*1.15,.62+random()*.28,.09+random()*.05);
    phases.push(random()*Math.PI*2);
  }
  const plane = new THREE.PlaneGeometry(1,1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index; geometry.setAttribute('position',plane.attributes.position); geometry.setAttribute('uv',plane.attributes.uv);
  geometry.setAttribute('aAnchor',new THREE.InstancedBufferAttribute(new Float32Array(anchors),3));
  geometry.setAttribute('aShape',new THREE.InstancedBufferAttribute(new Float32Array(shapes),3));
  geometry.setAttribute('aPhase',new THREE.InstancedBufferAttribute(new Float32Array(phases),1));
  geometry.instanceCount = count;
  const paths = Array.from({length:ACTORS},()=>new THREE.Vector4(10000,10000,10000,10000));
  const weights = new Float32Array(ACTORS), seen = new Uint8Array(ACTORS);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uMap:{value:getMistTexture()},uTime:{value:0},uLevel:{value:0},uMotion:{value:reduced?0:1},uCeiling:{value:.5},
    uColour:{value:new THREE.Color(0x82908a)},uPaths:{value:paths},uWeights:{value:weights},uCount:{value:0},
  }]);
  uniforms.uMap.value=getMistTexture(); uniforms.uPaths.value=paths; uniforms.uWeights.value=weights;
  const material = new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,fog:true,
    vertexShader:`attribute vec3 aAnchor,aShape; attribute float aPhase;
      uniform float uTime,uLevel,uMotion,uWeights[15]; uniform vec4 uPaths[15]; uniform int uCount;
      varying vec2 vUv; varying float vAlpha,vHeight,vPhase;
      #include <fog_pars_vertex>
      void main(){
        vec3 p=aAnchor; float nearby=0.0,wake=0.0; vec2 push=vec2(0.0);
        for(int i=0;i<15;i++){
          if(i>=uCount) break;
          vec4 path=uPaths[i]; vec2 direction=path.zw-path.xy;
          float f=clamp(dot(p.xz-path.xy,direction)/max(.0001,dot(direction,direction)),0.0,1.0);
          vec2 offset=p.xz-mix(path.xy,path.zw,f); float distance=length(offset);
          float strength=(1.0-smoothstep(.3,1.55,distance))*uWeights[i];
          if(strength>wake){wake=strength;push=offset/max(.15,distance)*strength*.28;}
          nearby=max(nearby,1.0-smoothstep(1.4,3.5,length(p.xz-path.zw)));
        }
        p.xz+=push;
        p.x+=sin(uTime*.16+aPhase)*.10*uMotion;
        p.z+=cos(uTime*.13+aPhase)*.12*uMotion;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
        vec2 corner=position.xy*aShape.xy*vec2(1.0+wake*.12,1.0);
        mvPosition.xy+=corner;
        // World height of a camera-facing corner, including a pitched view.
        vHeight=p.y+viewMatrix[1][1]*corner.y+viewMatrix[1][0]*corner.x;
        gl_Position=projectionMatrix*mvPosition;vUv=uv;vPhase=aPhase;
        vAlpha=aShape.z*uLevel*(.65+.35*nearby)*(1.0-wake*.62);
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform sampler2D uMap;uniform vec3 uColour;uniform float uTime,uMotion,uCeiling;
      varying vec2 vUv;varying float vAlpha,vHeight,vPhase;
      #include <fog_pars_fragment>
      void main(){
        vec2 uv=vUv;uv.x+=sin(vUv.y*4.1+uTime*.09*uMotion+vPhase)*.035;
        float floorBand=smoothstep(.005,.065,vHeight)*(1.0-smoothstep(uCeiling*.66,uCeiling,vHeight));
        gl_FragColor=vec4(uColour,texture2D(uMap,uv).a*vAlpha*floorBand);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry,material);mesh.name='foschia-bassa-della-folla';mesh.frustumCulled=false;mesh.visible=false;
  let prepared=false;
  return {mesh,paths,weights,count,metrics:{instances:count,triangles:count*2,drawCalls:1},
    reset(){seen.fill(0);weights.fill(0);uniforms.uCount.value=0;uniforms.uTime.value=0;mesh.visible=false;},
    track(index,x,z){
      if(index>=ACTORS)return;
      const path=paths[index];
      if(!seen[index]){path.set(x,z,x,z);seen[index]=1;return;}
      if(Math.hypot(x-path.z,z-path.w)>.025){path.set(path.z,path.w,x,z);weights[index]=1;}
    },
    update(dt,level,actors){
      const step=Math.max(0,dt),decay=Math.exp(-step/1.65);
      for(let i=0;i<ACTORS;i++)weights[i]*=decay;
      uniforms.uCount.value=Math.min(ACTORS,actors);uniforms.uLevel.value=Math.max(0,level);
      uniforms.uTime.value+=step;mesh.visible=level>.001&&actors>0;
    },
    async prepare(renderer,camera,scene){
      if(prepared)return;
      renderer.initTexture?.(uniforms.uMap.value);
      const visible=mesh.visible;let preparation;
      try{mesh.visible=true;preparation=renderer.compileAsync?.(mesh,camera,scene);}
      finally{mesh.visible=visible;}
      await preparation;prepared=true;
    },
  };
}
