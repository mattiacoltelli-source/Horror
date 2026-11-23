// Local damage at the crypt threshold: two batched draws and two small maps.
// The ember mask reuses the albedo sample; no new lights or collision objects.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

export function createCryptFissures({group,x=4,z=-215.5}) {
  const root=new THREE.Group();root.name='fratture-cripta';group.add(root);
  let seed=913,time=0,prepared=null;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const status={loaded:false,prepared:false,error:null},pending=[];
  function load(url){
    let resolve;pending.push(new Promise(r=>{resolve=r;}));
    const t=new THREE.TextureLoader().load(url,()=>resolve(true),undefined,()=>{status.error=url;resolve(false);});
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=1;return t;
  }
  const map=load('assets/tex/crypt_basalt.webp'),crackMap=load('assets/tex/crypt_fissure.webp');
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  const ready=Promise.all(pending).then(results=>(status.loaded=results.every(Boolean)));
  const ember={value:.6};
  const floorMat=new THREE.MeshLambertMaterial({map:crackMap,color:0xb0b0b0,transparent:true,alphaTest:.01,depthWrite:false,fog:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  floorMat.onBeforeCompile=shader=>{
    shader.uniforms.uCryptEmber=ember;
    shader.fragmentShader='uniform float uCryptEmber;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',
      'float emberMask = smoothstep(0.10, 0.35, (diffuseColor.r - max(diffuseColor.g, diffuseColor.b)) / max(diffuseColor.r, 0.0001));\noutgoingLight += diffuseColor.rgb * emberMask * uCryptEmber * 6.0;\n#include <opaque_fragment>');
  };
  floorMat.customProgramCacheKey=()=> 'crypt-ember-decal-v1';
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2.0,1.8),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(x+.24,.013,z);floor.name='brace-nelle-fratture';root.add(floor);
  const pieces=[],placements=[[.15,-1.27,.12],[-.18,-1.48,.10],[-.40,1.42,.15],[-.34,-1.24,.11]];
  for(const [ox,oz,size]of placements){
    const g=new THREE.IcosahedronGeometry(1,0),v=g.attributes.position,colors=[],rockSeed=random()*1000;
    for(let i=0;i<v.count;i++){
      // Duplicated face vertices must get the same deformation, otherwise a
      // non-indexed icosahedron splits into disconnected triangles.
      const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),h=Math.sin(px*12.99+py*78.23+pz*37.71+rockSeed)*43758.5453,n=h-Math.floor(h),k=.83+n*.24;
      v.setXYZ(i,px*size*1.1*k,py*size*.65*k,pz*size*k);
      const shade=.68+n*.18;colors.push(shade,shade,shade);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.rotateY(random()*Math.PI*2);g.translate(x+ox,size*.18,z+oz);pieces.push(g);
  }
  const rockGeo=mergeGeometries(pieces);for(const g of pieces)g.dispose();rockGeo.computeBoundingSphere();
  const rocks=new THREE.Mesh(rockGeo,new THREE.MeshLambertMaterial({map,vertexColors:true,color:0xbfb5ab,fog:true}));rocks.name='frammenti-basaltici';root.add(rocks);
  return {group:root,ready,status,
    update(dt,playerPosition){
      const distance=Math.hypot(playerPosition.x-x,playerPosition.z-z);root.visible=distance<8;
      if(root.visible){const fade=Math.max(0,Math.min(1,(8-distance)/3));time+=dt;floorMat.opacity=fade*fade*(3-2*fade);ember.value=.6+.045*Math.sin(time*.85);}
    },
    prepare(renderer,scene,camera){
      return prepared??=(async()=>{
        await ready;for(const t of [map,crackMap])if(t.image)renderer.initTexture(t);
        const visible=root.visible;root.visible=true;root.updateMatrixWorld(true);let compile;
        try{compile=renderer.compileAsync?renderer.compileAsync(root,camera,scene):renderer.compile(root,camera,scene);}
        finally{root.visible=visible;}
        await compile;status.prepared=true;
      })();
    }
  };
}
