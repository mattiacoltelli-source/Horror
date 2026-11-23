// First-tunnel landscape only. Same renderer/camera/controller as the corridor.
// Static geometry + an infinite starfield and a rectilinear celestial cutout:
// the reference galaxy is never stretched around an equirectangular sphere.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

export const COSMIC_ASSETS = ['assets/tex/cosmic_ground.webp', 'assets/tex/cosmic_galaxy.webp'];
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
  const terrainMaterial=new THREE.MeshBasicMaterial({map:groundTexture,vertexColors:true,fog:false});
  const light=new THREE.Vector3(-.22,.88,-.42).normalize(),normal=new THREE.Vector3();
  // The playable strip is exactly flat, matching the existing XZ controller.
  // Relief and mountains are outside that strip; there is no per-frame terrain work.
  const height=(wx,wz)=>{
    const forward=wx-x,cross=Math.abs(wz-z),off=Math.hypot(Math.max(0,cross-1.1),Math.max(0,forward-9));
    const amount=smooth(0,4,off),dist=Math.hypot(forward,cross);
    const broad=noise(wx*.10,wz*.10)*.66+noise(wx*.23+7,wz*.23)*.34;
    const ridge=1-Math.abs(2*noise(wx*.17+23,wz*.17-7)-1);
    return -.02+amount*((broad-.45)*.65+ridge*.6+smooth(15,40,dist)*(1.3+4.3*ridge)*(.5+.5*broad));
  };
  const positions=[],colors=[],uv=[],indices=[],NX=48,NZ=40;
  for(let i=0;i<=NX;i++)for(let j=0;j<=NZ;j++) {
    // More samples around the first few metres, fewer on the distant silhouettes.
    const wx=xStart+Math.pow(i/NX,1.55)*(x+54-xStart);
    const q=j/NZ*2-1,wz=z+Math.sign(q)*Math.pow(Math.abs(q),1.45)*34;
    const h=height(wx,wz),e=.18;
    normal.set(height(wx-e,wz)-height(wx+e,wz),2*e,height(wx,wz-e)-height(wx,wz+e)).normalize();
    const distance=Math.hypot(wx-x,wz-z),shade=.35+.50*Math.max(0,normal.dot(light));
    const fade=1-.92*smooth(22,55,distance);
    positions.push(wx,h,wz);uv.push(wx/uvScale[0],wz/uvScale[1]);
    colors.push(.32*shade*fade,.41*shade*fade,.49*shade*fade);
  }
  for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++) {
    const a=i*(NZ+1)+j,b=a+NZ+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeBoundingSphere();
  const terrain=new THREE.Mesh(geo,terrainMaterial);terrain.name='cosmo-terreno';group.add(terrain);

  let seed=613;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const pieces=[];
  for(let i=0;i<18;i++) {
    const wx=x+2+random()*19,side=i%2?1:-1,wz=z+side*(1.8+random()*8);
    const scale=.22+random()*.65,g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;
    const c=[],u=[];
    for(let k=0;k<p.count;k++) {
      const px=p.getX(k),py=p.getY(k),pz=p.getZ(k),r=.80+.24*noise(px*2+i,pz*2+py);
      const dx=px*r*scale*1.4,dy=py*r*scale*.46,dz=pz*r*scale;
      p.setXYZ(k,dx,dy,dz);u.push((wx+dx)/uvScale[0],(wz+dz)/uvScale[1]);
      const shade=.16+.38*Math.max(0,px*light.x+py*light.y+pz*light.z);
      c.push(.32*shade,.43*shade,.52*shade);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    g.deleteAttribute('normal');g.translate(wx,height(wx,wz)+scale*.2,wz);pieces.push(g);
  }
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
    group,groundTexture,ready,status,height,
    followCamera(camera) {if(group.visible)skyGroup.position.copy(camera.position);},
    setSkyBrightness(v) {galaxyMaterial.color.setScalar(v);starMaterial.color.setScalar(v);},
    prepare(renderer,scene,camera) {
      return prepared??=(async()=>{
        await ready;
        for(const t of [groundTexture,galaxyTexture])if(t.image)renderer.initTexture(t);
        group.updateMatrixWorld(true);
        if(renderer.compileAsync)await renderer.compileAsync(group,camera,scene);else renderer.compile(group,camera,scene);
        status.prepared=true;
      })();
    },
  };
}
