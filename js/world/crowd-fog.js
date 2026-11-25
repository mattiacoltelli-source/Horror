// A continuous undercoat closes gaps between dense overlapping smoke wisps.
// Everything is batched into one mesh, with the drain's existing alpha stamp.
import * as THREE from 'three';
import { getMistTexture } from './mist-texture.js';

const ACTORS=15;
export function createCrowdFog({reduced=false,lowQuality=false}={}){
  const count=lowQuality?128:192;
  const floor=new THREE.PlaneGeometry(11.8,39.6,lowQuality?6:8,lowQuality?24:32);
  floor.rotateX(-Math.PI/2);floor.translate(0,.025,-70.4);
  const position=Array.from(floor.attributes.position.array),uv=Array.from(floor.attributes.uv.array),index=Array.from(floor.index.array);
  const anchors=[],shapes=[],phases=[],base=[];
  for(let i=0;i<floor.attributes.position.count;i++){anchors.push(0,0,0);shapes.push(0,0,0);phases.push(0);base.push(1);}
  let seed=9127;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const halton=(i,b)=>{let f=1,r=0;for(let n=i;n>0;n=Math.floor(n/b)){f/=b;r+=f*(n%b);}return r;};
  const wisps=[];
  for(let i=0;i<count;i++){
    const x=-5.9+halton(i+1,2)*11.8,z=-50.7-halton(i+1,3)*39.4;
    const y=.24+random()*.16,width=3.4+random()*1.2,height=1.25+random()*.30;
    wisps.push([x,y,z,width,height,(.18+random()*.06)*(lowQuality?1.23:1),random()*Math.PI*2]);
  }
  wisps.sort((a,b)=>a[2]-b[2]);
  for(const [x,y,z,width,height,alpha,phase] of wisps){
    const start=position.length/3;
    for(const [qx,qy,u,v] of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,.5,0,1]]){
      position.push(qx,qy,0);uv.push(u,v);anchors.push(x,y,z);shapes.push(width,height,alpha);phases.push(phase);base.push(0);
    }
    index.push(start,start+1,start+2,start,start+2,start+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setIndex(index);
  for(const [name,values,size]of [['position',position,3],['uv',uv,2],['aAnchor',anchors,3],['aShape',shapes,3],['aPhase',phases,1],['aBase',base,1]])
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
  const baseVertices=floor.attributes.position.count;floor.dispose();
  const paths=Array.from({length:ACTORS},()=>new THREE.Vector4(10000,10000,10000,10000));
  const weights=new Float32Array(ACTORS),seen=new Uint8Array(ACTORS);
  const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
    uMap:{value:getMistTexture()},uTime:{value:0},uLevel:{value:0},uMotion:{value:reduced?0:1},uCeiling:{value:.7},uRise:{value:0},
    uColour:{value:new THREE.Color(0x718078)},uPaths:{value:paths},uWeights:{value:weights},uCount:{value:0},
  }]);
  uniforms.uMap.value=getMistTexture();uniforms.uPaths.value=paths;uniforms.uWeights.value=weights;
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,fog:true,
    vertexShader:`attribute vec3 aAnchor,aShape;attribute float aPhase,aBase;
      uniform float uTime,uLevel,uMotion,uRise,uWeights[15];uniform vec4 uPaths[15];uniform int uCount;
      varying vec2 vUv,vWorld;varying float vAlpha,vHeight,vPhase,vBase;
      #include <fog_pars_vertex>
      void main(){
        vec3 p=aBase>.5?position:aAnchor;float wake=0.0,t=uTime*uMotion;
        for(int i=0;i<15;i++){
          if(i>=uCount)break;
          vec4 path=uPaths[i];vec2 direction=path.zw-path.xy;
          float f=clamp(dot(p.xz-path.xy,direction)/max(.0001,dot(direction,direction)),0.0,1.0);
          float distance=length(p.xz-mix(path.xy,path.zw,f));
          wake=max(wake,(1.0-smoothstep(.25,1.45,distance))*uWeights[i]);
        }
        if(aBase<.5){p.x+=sin(t*.16+aPhase)*.09*uMotion;p.z+=cos(t*.13+aPhase)*.10*uMotion;p.y=mix(.025,p.y,uRise);}
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
        vHeight=p.y;
        if(aBase<.5){
          vec2 corner=position.xy*aShape.xy*vec2(1.0,uRise);
          mvPosition.xy+=corner;
          vHeight+=viewMatrix[1][1]*corner.y+viewMatrix[1][0]*corner.x;
        }
        gl_Position=projectionMatrix*mvPosition;vUv=uv;vWorld=p.xz;vPhase=aPhase;vBase=aBase;
        vAlpha=uLevel*uRise*(1.0-wake*.20)*(aBase>.5?1.0:aShape.z);
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform sampler2D uMap;uniform vec3 uColour;uniform float uTime,uMotion,uCeiling,uRise;
      varying vec2 vUv,vWorld;varying float vAlpha,vHeight,vPhase,vBase;
      #include <fog_pars_fragment>
      void main(){
        float t=uTime*uMotion,alpha;vec3 colour=uColour;
        if(vBase>.5){
          float detail=texture2D(uMap,fract(vWorld*.09+vec2(t*.005,-t*.003))).a;
          float edge=smoothstep(0.0,.12,5.9-abs(vWorld.x))*smoothstep(0.0,.30,min(-50.6-vWorld.y,vWorld.y+90.2));
          alpha=(.58+.045*detail)*vAlpha*edge;colour*=.82;
        }else{
          float ceiling=mix(.025,uCeiling,uRise);
          if(vHeight<0.0||vHeight>=ceiling)discard;
          vec2 uv=vUv;uv.x+=sin(vUv.y*4.1+t*.09+vPhase)*.035;
          float band=smoothstep(0.0,.035,vHeight)*(1.0-smoothstep(ceiling*.60,ceiling,vHeight));
          alpha=texture2D(uMap,uv).a*vAlpha*band;
        }
        gl_FragColor=vec4(colour,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='foschia-bassa-della-folla';mesh.frustumCulled=false;mesh.visible=false;
  let prepared=false,riseAge=0,riseStarted=false;
  return {mesh,paths,weights,count,baseVertices,metrics:{wisps:count,baseLayers:1,triangles:index.length/3,drawCalls:1},
    reset(){seen.fill(0);weights.fill(0);uniforms.uCount.value=0;uniforms.uTime.value=0;uniforms.uRise.value=0;riseAge=0;riseStarted=false;mesh.visible=false;},
    track(i,x,z){
      if(i>=ACTORS)return;const path=paths[i];
      if(!seen[i]){path.set(x,z,x,z);seen[i]=1;return;}
      if(Math.hypot(x-path.z,z-path.w)>.025){path.set(path.z,path.w,x,z);weights[i]=1;}
    },
    update(dt,level,actors){
      const step=Math.max(0,dt),decay=Math.exp(-step/1.65);for(let i=0;i<ACTORS;i++)weights[i]*=decay;
      // Start on the first reveal, then keep the mist in place through the
      // existing blackouts. Five seconds of game time, including at low FPS.
      if(level>.001&&actors>0)riseStarted=true;
      if(riseStarted)riseAge=Math.min(5,riseAge+step);
      const progress=riseAge/5;uniforms.uRise.value=progress*progress*(3-2*progress);
      uniforms.uCount.value=Math.min(ACTORS,actors);uniforms.uLevel.value=Math.max(0,level);uniforms.uTime.value+=step;
      mesh.visible=level>.001&&actors>0&&uniforms.uRise.value>0;
    },
    async prepare(renderer,camera,scene){
      if(prepared)return;renderer.initTexture?.(uniforms.uMap.value);
      const visible=mesh.visible;let preparation;
      try{mesh.visible=true;preparation=renderer.compileAsync?.(mesh,camera,scene);}finally{mesh.visible=visible;}
      await preparation;prepared=true;
    },
  };
}
