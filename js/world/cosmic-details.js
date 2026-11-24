// Static distant silhouettes reuse the rock batch and its map. No animation,
// lights, collision bodies or additional image downloads.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
export function createCosmicDeadwood({terrainGeometry,x,z}) {
  const pieces=[],support=new THREE.Mesh(terrainGeometry),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  support.updateMatrixWorld(true);
  const ground=(wx,wz)=>{ray.set(new THREE.Vector3(wx,100,wz),down);const h=ray.intersectObject(support)[0];if(!h)throw Error('Deadwood outside cosmic terrain');return h.point.y;};
  const tube=(path,radii,seed)=>{
    const p=[],uv=[],colors=[],index=[],sides=6,up=new THREE.Vector3(),right=new THREE.Vector3(),forward=new THREE.Vector3(),v=new THREE.Vector3();
    let length=0;
    for(let k=0;k<path.length;k++){
      if(k)length+=path[k].distanceTo(path[k-1]);
      up.subVectors(path[Math.min(k+1,path.length-1)],path[Math.max(0,k-1)]).normalize();
      right.set(Math.abs(up.x)<.8?1:0,0,Math.abs(up.x)<.8?0:1).addScaledVector(up,Math.abs(up.x)<.8?-up.x:-up.z).normalize();
      forward.crossVectors(up,right).normalize();
      for(let j=0;j<=sides;j++){
        const a=j/sides*Math.PI*2,r=radii[k]*(.87+.18*hash(j%sides,seed));
        v.copy(path[k]).addScaledVector(right,Math.cos(a)*r).addScaledVector(forward,Math.sin(a)*r);
        p.push(v.x,v.y,v.z);uv.push(j/sides*.65,length*.7);
        const shade=(.7+.3*hash(j%sides,seed))*(k===0 ? .55 : 1);colors.push(.22*shade,.20*shade,.19*shade);
      }
    }
    for(let k=0;k<path.length-1;k++)for(let j=0;j<sides;j++){
      const a=k*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,a+1,b+1,b);
    }
    for(const end of [0,path.length-1]){
      const center=p.length/3,q=path[end];p.push(q.x,q.y,q.z);uv.push(.32,end ? .7 : 0);colors.push(.28,.26,.24);
      for(let j=0;j<sides;j++){const a=end*(sides+1)+j;index.push(...(end?[center,a,a+1]:[center,a+1,a]));}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();pieces.push(g.toNonIndexed());g.dispose();
  };
  const point=(cx,cy,cz,dx,dy,dz)=>new THREE.Vector3(cx+dx,cy+dy,cz+dz);
  for(const [ox,oz,height,radius,lean,seed]of [[28,-14,3.6,.26,-.42,17],[35,18,4.2,.32,.58,29],[39,-23,3.0,.24,-.30,41],[31,-20,1.3,.35,.16,53]]){
    const cx=x+ox,cz=z+oz,cy=ground(cx,cz)-.10;
    const path=[[0,0,0],[lean*.10,height*.25,.07],[lean*.45,height*.55,-.09],[lean*.8,height*.82,.06],[lean,height,-.08]].map(a=>point(cx,cy,cz,...a));
    tube(path,[radius*1.35,radius,radius*.78,radius*.53,radius*.32],seed);
    if(height>2){
      for(const [level,sign]of [[2,-1],[3,1]]){
        // Branch across the view as well as into depth, so the silhouette reads
        // as broken deadwood from the entrance rather than a straight pole.
        const start=path[level],reach=.95+.5*hash(level,seed),rise=.35+.5*hash(seed,level),angle=sign*(1.15+.25*hash(seed,level));
        const dx=Math.cos(angle)*reach*.45,dz=Math.sin(angle)*reach;
        tube([start,start.clone().add(new THREE.Vector3(dx*.55,rise*.25,dz*.5)),start.clone().add(new THREE.Vector3(dx,rise,dz))],[radius*.38,radius*.21,.025],seed+level);
      }
    }
    for(let j=0;j<3;j++){
      const a=j*2.1+seed,dx=Math.cos(a)*radius*2.4,dz=Math.sin(a)*radius*2.4;
      tube([point(cx,cy,cz,0,.27,0),point(cx,ground(cx+dx,cz+dz)-.09,cz,dx,0,dz)],[radius*.45,.025],seed+j+7);
    }
  }
  for(const [ox,oz,length,angle,seed]of [[23,12,2.8,.7,67],[40,22,3.8,-.5,79]]){
    const cx=x+ox,cz=z+oz,dx=Math.cos(angle)*length,dz=Math.sin(angle)*length;
    const path=[0,.45,1].map(t=>new THREE.Vector3(cx+dx*t,ground(cx+dx*t,cz+dz*t)+.04,cz+dz*t));
    tube(path,[.23,.19,.12],seed);
  }
  const geometry=mergeGeometries(pieces);for(const p of pieces)p.dispose();geometry.computeBoundingSphere();support.material.dispose();
  return geometry;
}

export function createCosmicSkyAccent(map) {
  const geometry=new THREE.SphereGeometry(2.2,24,12),p=geometry.attributes.position,normal=geometry.attributes.normal,colors=[];
  const sun=new THREE.Vector3(-.7,.25,.65).normalize(),n=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    n.fromBufferAttribute(normal,i);const light=.012+Math.max(0,n.dot(sun))*.95;
    colors.push(light*.64,light*.69,light*.77);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.MeshBasicMaterial({map,vertexColors:true,fog:false,toneMapped:false,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material),az=65*Math.PI/180,el=25*Math.PI/180;
  mesh.position.set(43*Math.cos(el)*Math.cos(az),43*Math.sin(el),43*Math.cos(el)*Math.sin(az));
  mesh.name='cosmo-luna-laterale';mesh.renderOrder=-11;
  return mesh;
}
