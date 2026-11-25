// Lava decals follow the actual terrain triangles, including distant relief.
// One batched draw and one albedo/alpha map; no simulation or extra lights.
import * as THREE from 'three';
import { createLavaFire } from './lava-fire.js';

export function createCosmicLava({terrainGeometry,map,x,z}) {
  const position=terrainGeometry.attributes.position,index=terrainGeometry.index;
  const positions=[],uv=[],colors=[];
  // All flows sit on the distant hills: the foreground beyond the arch stays dry.
  const fields=[[24.0,-5.5,8.0,5.0,.20],[29.0,6.8,9.0,6.0,-.25],[32.0,.3,12.0,8.0,-.12]];
  const clip=(vertices,axis,bound,sign)=>{
    const out=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));
      }
    }
    return out;
  };
  for(let field=0;field<fields.length;field++){
    const [ox,oz,width,depth,angle]=fields[field];
    const cx=x+ox,cz=z+oz,c=Math.cos(angle),s=Math.sin(angle);
    for(let i=0;i<index.count;i+=3){
      let polygon=[];
      for(let j=0;j<3;j++){
        const k=index.getX(i+j),wx=position.getX(k),wy=position.getY(k),wz=position.getZ(k),dx=wx-cx,dz=wz-cz;
        polygon.push([wx,wy,wz,(dx*c+dz*s)/width+.5,(-dx*s+dz*c)/depth+.5]);
      }
      for(const [axis,bound,sign]of [[3,0,1],[3,1,-1],[4,0,1],[4,1,-1]])polygon=clip(polygon,axis,bound,sign);
      for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
        positions.push(v[0],v[1]+.006,v[2]);uv.push(field===1?1-v[3]:v[3],field===2?1-v[4]:v[4]);
        const shade=.94+.06*Math.sin(v[0]*.57+v[2]*.41);colors.push(shade,shade,shade);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({map,vertexColors:true,transparent:true,alphaTest:.006,depthWrite:false,fog:false,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  // Cool crust blends into the dark terrain while molten rock stays bright.
  // The soft border samples the same map, without a new texture or render pass.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
        float molten=smoothstep(.12,.55,sampledDiffuseColor.r-sampledDiffuseColor.b*.8);
        float fringe=smoothstep(.08,.78,sampledDiffuseColor.a);
        diffuseColor.rgb*=mix(.16,1.0,molten)*mix(.35,1.0,fringe);
        // The halo reuses this surface and map; no second terrain draw or
        // framebuffer. Four local taps soften the molten/crust transition.
        vec4 e0=texture2D(map,vMapUv+vec2(.024,0.0)),e1=texture2D(map,vMapUv-vec2(.024,0.0));
        vec4 e2=texture2D(map,vMapUv+vec2(0.0,.024)),e3=texture2D(map,vMapUv-vec2(0.0,.024));
        float bloom=(max(0.0,e0.r-e0.b*.8)*e0.a+max(0.0,e1.r-e1.b*.8)*e1.a+max(0.0,e2.r-e2.b*.8)*e2.a+max(0.0,e3.r-e3.b*.8)*e3.a)*.25;
        float halo=bloom*.13*diffuse.r,baseAlpha=diffuseColor.a;
        float softAlpha=baseAlpha+halo*(1.0-baseAlpha);
        diffuseColor.rgb=(diffuseColor.rgb*baseAlpha+vec3(1.0,.17,.012)*halo*(1.0-baseAlpha))/max(.001,softAlpha);
        diffuseColor.rgb+=vec3(.07,.011,.001)*bloom*(1.0-molten)*fringe*diffuse;
        diffuseColor.a=softAlpha;
      #endif`);
  };
  material.customProgramCacheKey=()=> 'cosmic-lava-crust-glow-v2';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='cosmo-lava-incandescente';
  const fire=createLavaFire({terrainGeometry,fields,x,z,reduced:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false});
  return {mesh,fire,update(t){fire.update(t);},setBrightness(v){material.color.setScalar(v*1.15);fire.setBrightness(v);}};
}
