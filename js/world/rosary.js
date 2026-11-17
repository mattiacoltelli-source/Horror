import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';
import { addContactShadow } from './contact-shadows.js';

export function createBrokenRosary(parent,{x,y,z}) {
  const group=new THREE.Group();group.name='rosario-spezzato';group.position.set(x,y,z);parent.add(group);
  const beadMat=new THREE.MeshStandardMaterial({color:0x34271c,roughness:.9});
  const cordMat=new THREE.MeshStandardMaterial({color:0x3a3024,roughness:1});
  const crossMat=new THREE.MeshStandardMaterial({color:0x51412c,roughness:.93,vertexColors:true});
  const metal=new THREE.MeshStandardMaterial({color:0x71634d,roughness:.86,metalness:.35});
  const points=[],loose=[[-.055,-.090],[-.079,-.119],[-.035,-.130],[-.014,-.119]],spots=[];
  for(let i=0;i<33;i++){
    const a=4.10+i/32*5.53,px=.090*Math.cos(a)+Math.sin(i*1.71)*.0015,pz=.105*Math.sin(a);
    const r=i===10||i===21?.006:.0048;spots.push({p:[px,.0022+r,pz],r});points.push(new THREE.Vector3(px,.0062,pz));
  }
  for(const [px,pz]of loose)spots.push({p:[px,.0068,pz],r:.0046});
  for(const px of [-.109,-.128,-.146])spots.push({p:[px,.0068,0],r:.0046});
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),beadMat,spots.length),matrix=new THREE.Matrix4();
  spots.forEach(({p,r},i)=>{matrix.makeScale(r,r*.96,r);matrix.setPosition(...p);beads.setMatrixAt(i,matrix);if(i%3===0||i>=33)addContactShadow(group,{x:p[0],y:.0004,z:p[2],w:r*3,d:r*3,strength:.30});});
  beads.name='grani-rosario';beads.computeBoundingSphere();group.add(beads);
  const thread=[];
  const wire=(p)=>thread.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p),Math.max(6,p.length*2),.00065,4,false));
  wire([points[0].clone().add(new THREE.Vector3(.009,-.001,.003)),...points,points.at(-1).clone().add(new THREE.Vector3(.009,-.001,-.002))]);
  wire([new THREE.Vector3(-.090,.006,0),new THREE.Vector3(-.12,.0068,0),new THREE.Vector3(-.15,.0068,0)]);
  const string=new THREE.Mesh(mergeGeometries(thread,false),cordMat);string.name='filo-rotto-rosario';group.add(string);thread.forEach(g=>g.dispose());
  const medallion=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.002,10),metal);medallion.position.set(-.094,.0033,0);group.add(medallion);
  const parts=[new THREE.BoxGeometry(.10,.006,.014).translate(-.20,.0052,0),new THREE.BoxGeometry(.015,.006,.054).translate(-.182,.0052,0)];
  for(const geo of parts){const colors=[],p=geo.attributes.position;for(let i=0;i<p.count;i++){const edge=.80+.16*Math.sin(p.getX(i)*89+p.getZ(i)*113);colors.push(edge,edge*.94,edge*.84);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));}
  const cross=new THREE.Mesh(mergeGeometries(parts,false),crossMat);cross.name='croce-rosario';group.add(cross);parts.forEach(g=>g.dispose());
  addContactShadow(group,{x:-.20,y:.0003,w:.12,d:.071,strength:.25});group.userData.beadCount=spots.length;
  return group;
}
