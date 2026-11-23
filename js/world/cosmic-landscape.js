// First-tunnel landscape only. Same renderer/camera/controller as the corridor.
// Static geometry + an infinite starfield and a rectilinear celestial cutout:
// the reference galaxy is never stretched around an equirectangular sphere.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';
import { createCosmicLava } from './cosmic-lava.js';
import { createCosmicBoulders } from './cosmic-boulders.js';

export const COSMIC_ASSETS = ['assets/tex/cosmic_ground.webp', 'assets/tex/cosmic_galaxy.webp', 'assets/tex/cosmic_lava.webp'];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const smooth = (a,b,x) => { const u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u); };
const hash = (x,z) => {const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);};
const noise = (x,z) => {
  const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);
  return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;
};

export function createCosmicLandscape({x,z,xStart=x+.4,uvScale=[1.6,1.6]}) {
  const group=new THREE.Group();group.name='pianeta-alieno';
  const skyGroup=new THREE.Group();skyGroup.name='cosmo-cielo-infinito';group.add(skyGroup);
  const status={loaded:false,prepared:false,error:null};
  const pending=[];
  function load(url) {
    let resolve,reject;
    pending.push(new Promise((res,rej)=>{resolve=res;reject=rej;}));
    const t=new THREE.TextureLoader().load(url,resolve,undefined,()=>reject(new Error('Cosmic asset: '+url)));
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=globalThis.__lowQ?1:2;return t;
  }
  const groundTexture=load(COSMIC_ASSETS[0]);
  groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;
  const galaxyTexture=load(COSMIC_ASSETS[1]);
  const lavaTexture=load(COSMIC_ASSETS[2]);
  // Fine photographic gravel plus real vertex lighting. Lambert reuses the
  // existing flashlight/hemisphere lights, with one albedo sample and no PBR maps.
  const terrainMaterial=new THREE.MeshLambertMaterial({map:groundTexture,vertexColors:true,fog:false});
  // The galaxy gives a faint, constant fill outside the reach of the torch.
  // Reuse the already sampled albedo: no extra lights or texture lookups.
  terrainMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight += diffuseColor.rgb * vec3(0.08, 0.10, 0.14);\n#include <opaque_fragment>');
  };
  terrainMaterial.customProgramCacheKey=()=> 'cosmic-gravel-starlight-v1';
  const groundTint=(wx,wz)=>{
    const forward=wx-x,cross=Math.abs(wz-z),distance=Math.hypot(forward,cross);
    const outside=Math.max(smooth(2.2,8.0,forward),smooth(.8,4.5,cross));
    const patches=.7*noise(wx*.23+11,wz*.19+17)+.3*noise(wx*.09-5,wz*.11+2);
    return (.90-.28*outside)*(.85+.15*patches)*(1-.94*smooth(22,55,distance));
  };
  // The playable strip is exactly flat, matching the existing XZ controller.
  // Relief and mountains are outside that strip; there is no per-frame terrain work.
  const height=(wx,wz)=>{
    const forward=wx-x,cross=Math.abs(wz-z),off=Math.hypot(Math.max(0,cross-1.1),Math.max(0,forward-9));
    const amount=smooth(0,4,off),dist=Math.hypot(forward,cross);
    const broad=noise(wx*.10,wz*.10)*.66+noise(wx*.23+7,wz*.23)*.34;
    const ridge=1-Math.abs(2*noise(wx*.17+23,wz*.17-7)-1);
    const banks=smooth(.84,1.7,cross)*((noise(wx*.9+4,wz*.8)-.5)*.14+(noise(wx*1.7,wz*1.4+8)-.5)*.05);
    return -.02+banks+amount*((broad-.45)*.65+ridge*.6+smooth(15,40,dist)*(1.3+4.3*ridge)*(.5+.5*broad));
  };
  const positions=[],colors=[],uv=[],indices=[],NX=48,NZ=40;
  for(let i=0;i<=NX;i++)for(let j=0;j<=NZ;j++) {
    // More samples around the first few metres, fewer on the distant silhouettes.
    const wx=xStart+Math.pow(i/NX,1.55)*(x+54-xStart);
    const q=j/NZ*2-1,row=Math.abs(j-NZ/2);
    // Explicit rows at the player-footprint boundary prevent neighbouring
    // relief triangles from interpolating into the safe walking strip.
    const cross=row<=2?row*.42:Math.pow(Math.abs(q),1.7)*34,wz=z+Math.sign(q)*cross;
    const h=height(wx,wz),shade=groundTint(wx,wz);
    positions.push(wx,h,wz);uv.push(wx/uvScale[0],wz/uvScale[1]);
    colors.push(.48*shade,.49*shade,.52*shade);
  }
  for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++) {
    const a=i*(NZ+1)+j,b=a+NZ+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
  const terrain=new THREE.Mesh(geo,terrainMaterial);terrain.name='cosmo-terreno';group.add(terrain);
  const lava=createCosmicLava({terrainGeometry:geo,map:lavaTexture,x,z});group.add(lava.mesh);

  let seed=613;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const pieces=[];
  for(let i=0;i<18;i++) {
    const wx=x+(i<6?2.9+random()*3.6:5+random()*15),side=i%2?1:-1,scale=.18+random()*.55;
    const wz=z+side*(.94+scale*1.5+random()*(i<6?1.3:4.5));
    const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;
    const c=[],u=[];
    for(let k=0;k<p.count;k++) {
      const px=p.getX(k),py=p.getY(k),pz=p.getZ(k),r=.80+.24*noise(px*2+i,pz*2+py);
      const dx=px*r*scale*1.4,dy=py*r*scale*.38,dz=pz*r*scale;
      p.setXYZ(k,dx,dy,dz);u.push((wx+dx)/uvScale[0],(wz+dz)/uvScale[1]);
      const shade=groundTint(wx+dx,wz+dz);
      c.push(.40*shade,.41*shade,.44*shade);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    g.computeVertexNormals();g.rotateY(hash(wx+17,wz-11)*Math.PI*2);g.translate(wx,height(wx,wz)+scale*.08,wz);pieces.push(g);
  }
  pieces.push(...createCosmicBoulders({terrainGeometry:geo,x,z,groundTint,uvScale}));
  const rockGeometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();rockGeometry.computeBoundingSphere();
  const rocks=new THREE.Mesh(rockGeometry,terrainMaterial);rocks.name='cosmo-massi';group.add(rocks);

  // Uniformly distributed, static stars all around the player, in one draw call.
  // They are not an animated particle system and require no texture or simulation.
  const sp=[],sc=[],count=globalThis.__lowQ?1400:3500,starColor=new THREE.Color();
  for(let i=0;i<count;i++) {
    const az=random()*Math.PI*2,y=-.04+random()*1.04,r=Math.sqrt(1-y*y),radius=46;
    sp.push(radius*r*Math.cos(az),radius*y,radius*r*Math.sin(az));
    const brightness=.24+Math.pow(random(),5)*.76;
    starColor.setRGB(brightness*(.76+random()*.24),brightness*(.84+random()*.16),brightness);
    sc.push(starColor.r,starColor.g,starColor.b);
  }
  const starGeometry=new THREE.BufferGeometry();
  starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(sc,3));
  const starMaterial=new THREE.PointsMaterial({size:1.25,sizeAttenuation:false,vertexColors:true,depthWrite:false,fog:false,toneMapped:false});
  const stars=new THREE.Points(starGeometry,starMaterial);stars.frustumCulled=false;stars.renderOrder=-12;stars.name='cosmo-stelle';skyGroup.add(stars);

  // A camera-translated, world-oriented rectilinear plate preserves the galaxy's
  // photographed aspect and diagonal. Looking around does not rotate it with you.
  const galaxyMaterial=new THREE.MeshBasicMaterial({map:galaxyTexture,transparent:true,alphaTest:.004,depthWrite:false,fog:false,toneMapped:false});
  const galaxy=new THREE.Mesh(new THREE.PlaneGeometry(61,61*768/1500),galaxyMaterial);
  const elevation=16*Math.PI/180;
  galaxy.position.set(38*Math.cos(elevation),38*Math.sin(elevation),0);
  galaxy.lookAt(0,0,0);galaxy.renderOrder=-10;galaxy.frustumCulled=false;galaxy.name='cosmo-galassia';skyGroup.add(galaxy);
  const origin=new THREE.Vector3(x,1.62,z);skyGroup.position.copy(origin);
  let prepared=null;
  const ready=Promise.all(pending).then(()=>{status.loaded=true;return true;}).catch(error=>{
    status.error=error;galaxy.visible=false;console.warn(error);return false;
  });
  return {
    group,groundTexture,groundMaterial:terrainMaterial,ready,status,height,
    followCamera(camera) {if(group.visible)skyGroup.position.copy(camera.position);},
    setSkyBrightness(v) {galaxyMaterial.color.setScalar(v);starMaterial.color.setScalar(v);lava.setBrightness(v);},
    prepare(renderer,scene,camera) {
      return prepared??=(async()=>{
        await ready;
        for(const t of [groundTexture,galaxyTexture,lavaTexture])if(t.image)renderer.initTexture(t);
        group.updateMatrixWorld(true);
        if(renderer.compileAsync)await renderer.compileAsync(group,camera,scene);else renderer.compile(group,camera,scene);
        status.prepared=true;
      })();
    },
  };
}
