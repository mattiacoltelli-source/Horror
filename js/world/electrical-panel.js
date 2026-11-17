// Vecchio quadro a fusibili: sportello su due cerniere, tubi fino al soffitto,
// ceramica e fissaggi reali. Oggetto ornamentale, senza luci o interazioni.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';
import { addContactShadow } from './contact-shadows.js';

export function createElectricalPanel(parent,mats,{x,y,z}) {
  const group=new THREE.Group();group.name='quadro-elettrico-reparto';group.position.set(x,y,z);group.rotation.y=Math.PI/2;group.userData.ornamental=true;parent.add(group);
  const paint=mats.rust.clone();paint.vertexColors=false;paint.color.setHex(0x687266);paint.metalness=.35;paint.roughness=.94;
  const metal=new THREE.MeshStandardMaterial({color:0x51483b,roughness:.86,metalness:.5});
  const inside=new THREE.MeshStandardMaterial({color:0x35372d,roughness:1,metalness:.2});
  const ceramic=new THREE.MeshStandardMaterial({color:0xa49b82,roughness:.94});
  const black=new THREE.MeshStandardMaterial({color:0x181914,roughness:1});
  const sets=new Map(),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1);
  const put=(geo,mat,p=[0,0,0],rot=[0,0,0],root=group)=>{
    q.setFromEuler(new THREE.Euler(...rot));matrix.compose(new THREE.Vector3(...p),q,s);geo.applyMatrix4(matrix);
    const flat=geo.index?geo.toNonIndexed():geo;if(flat!==geo)geo.dispose();
    if(!sets.has(root))sets.set(root,new Map());const bins=sets.get(root);if(!bins.has(mat))bins.set(mat,[]);bins.get(mat).push(flat);
  };
  const box=(mat,p,w,h,d,root=group)=>put(new THREE.BoxGeometry(w,h,d),mat,p,[0,0,0],root);
  box(paint,[0,0,.012],.46,.62,.024);box(inside,[0,0,.032],.42,.58,.012);
  for(const side of [-1,1]){box(paint,[side*.224,0,.052],.012,.62,.080);box(paint,[0,side*.304,.052],.46,.012,.080);}
  for(const xx of [-.198,.198])for(const yy of [-.277,.277]){
    put(new THREE.CylinderGeometry(.006,.006,.004,7),metal,[xx,yy,.041],[Math.PI/2,0,0]);
    box(black,[xx,yy,.044],.007,.0015,.001);
  }
  for(const xx of [-.10,.10])for(const yy of [-.13,.13]){
    put(new THREE.CylinderGeometry(.029,.031,.011,10),metal,[xx,yy,.043],[Math.PI/2,0,0]);
    if(xx>0&&yy<0){put(new THREE.CylinderGeometry(.020,.020,.004,10),black,[xx,yy,.050],[Math.PI/2,0,0]);continue;}
    put(new THREE.CylinderGeometry(.024,.027,.018,10),ceramic,[xx,yy,.053],[Math.PI/2,0,0]);
    put(new THREE.CylinderGeometry(.008,.008,.003,8),metal,[xx,yy,.064],[Math.PI/2,0,0]);
    box(ceramic,[xx,yy-.047,.040],.047,.012,.0015);
  }
  for(const xx of [-.12,.07]){
    put(new THREE.CylinderGeometry(.010,.010,.40,8),metal,[xx,.50,.018]);
    for(const yy of [.38,.63]){box(paint,[xx,yy,.015],.037,.013,.013);put(new THREE.CylinderGeometry(.003,.003,.004,6),metal,[xx+.013,yy,.025],[Math.PI/2,0,0]);}
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(xx,.30,.025),new THREE.Vector3(xx,.23,.04),new THREE.Vector3(xx-.025,.18,.042)]);
    put(new THREE.TubeGeometry(curve,5,.002,4,false),black);
  }
  const hinge=new THREE.Group();hinge.name='sportello-quadro-socchiuso';hinge.position.set(-.229,0,.094);hinge.rotation.y=-.22;group.add(hinge);
  // Lamiera con smusso sottile: il bordo non e' una sagoma piatta sul muro.
  const outline=new THREE.Shape();outline.moveTo(.006,-.296);outline.lineTo(.440,-.298);outline.lineTo(.447,-.291);outline.lineTo(.444,.292);outline.lineTo(.436,.300);outline.lineTo(.006,.297);outline.closePath();
  const door=new THREE.ExtrudeGeometry(outline,{depth:.009,bevelEnabled:true,bevelSize:.0025,bevelThickness:.002,bevelSegments:1,curveSegments:1});
  const pos=door.attributes.position,uv=door.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/.45,(pos.getY(i)+.30)/.60);
  put(door,paint,[0,0,0],[0,0,0],hinge);box(metal,[.416,-.025,.013],.018,.044,.009,hinge);
  for(const yy of [-.215,.215]){put(new THREE.CylinderGeometry(.009,.009,.055,8),metal,[-.230,yy,.094]);box(metal,[-.215,yy,.089],.032,.039,.007);}
  const backing=new THREE.Group();backing.rotation.x=Math.PI/2;group.add(backing);addContactShadow(backing,{w:.53,d:.70,strength:.30});
  for(const [root,bins]of sets)for(const [mat,geos]of bins){const mesh=new THREE.Mesh(mergeGeometries(geos,false),mat);mesh.matrixAutoUpdate=false;root.add(mesh);geos.forEach(g=>g.dispose());}
  return group;
}
