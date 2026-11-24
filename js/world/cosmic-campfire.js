// Distant user-supplied campfire, baked offline into the existing rock batch.
// One small unlit flame draw, no textures, particles or additional lights.
import * as THREE from 'three';
import { CAMPFIRE_POSITION,CAMPFIRE_COLOR } from './campfire-data.js';

export function createCosmicCampfire({terrainGeometry,x,z,uvScale}){
  const cx=x+24,cz=z+10,support=new THREE.Mesh(terrainGeometry),ray=new THREE.Raycaster(new THREE.Vector3(cx,100,cz),new THREE.Vector3(0,-1,0));
  support.updateMatrixWorld(true);const hit=ray.intersectObject(support)[0];support.material.dispose();
  if(!hit)throw Error('Campfire outside cosmic terrain');
  const cy=hit.point.y-.07,scale=2,positions=[],uv=[],colors=[];
  for(let i=0;i<CAMPFIRE_POSITION.length;i+=3){
    const wx=cx+CAMPFIRE_POSITION[i]*scale,wy=cy+CAMPFIRE_POSITION[i+1]*scale,wz=cz+CAMPFIRE_POSITION[i+2]*scale;
    positions.push(wx,wy,wz);uv.push(wx/uvScale[0],wz/uvScale[1]);
    // The original atlas is sampled offline, retaining stone/charred wood
    // separation while reusing the ground material and its faint starlight.
    for(let j=0;j<3;j++)colors.push(.10+CAMPFIRE_COLOR[i+j]*1.7);
  }
  const wood=new THREE.BufferGeometry();wood.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));wood.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));wood.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));wood.computeVertexNormals();wood.computeBoundingSphere();
  const p=[],c=[],indices=[];
  for(let j=0;j<3;j++){
    const a=j*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a),base=p.length/3;
    for(const [u,y,r,g,b,alpha]of [[-.27,0,.9,.12,.01,0],[.27,0,.9,.12,.01,0],[-.19,.22,1,.45,.025,.8],[.19,.22,1,.45,.025,.8],[-.10,.65,1,.17,.005,.55],[.13,.65,1,.17,.005,.55],[.08,1.15,.5,.015,0,0]]){
      p.push(u*ca,y,u*sa);c.push(r,g,b,alpha);
    }
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4,base+4,base+5,base+6);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(c,4));geo.setIndex(indices);geo.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,side:THREE.DoubleSide,depthWrite:false,fog:false,toneMapped:false,blending:THREE.AdditiveBlending});
  const flames=new THREE.Mesh(geo,material);flames.name='cosmo-falo-lontano';flames.position.set(cx,cy+.28,cz);
  return{wood,flames,update(t){flames.scale.y=.93+.06*Math.sin(t*7.3)+.035*Math.sin(t*13.1);flames.rotation.y=.10*Math.sin(t*2.3);},setBrightness(v){material.opacity=Math.max(0,Math.min(1,v))*.8;}};
}
