// Closed, bevelled stone courses in one static batch. The opening is unchanged.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const hash=(x,y,z,seed)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7+seed)*43758.5453;return n-Math.floor(n);};
export function createWornArch({stone,side,wallX,centerZ,radius,spring,seed}) {
  const group=new THREE.Group();group.name='arco-pietra-consumata';
  const parts=[],matrix=new THREE.Matrix4().set(0,0,side,side*(wallX-.09),0,1,0,0,-side,0,0,centerZ,0,0,0,1);
  const add=(shape,depth,shade,offset=0,bevel=.012)=>{
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSegments:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:2});
    const p=geometry.attributes.position;
    // Equal positions share the same erosion, including duplicate face vertices.
    for(let i=0;i<p.count;i++){
      const x=Math.round(p.getX(i)*1e6)/1e6,y=Math.round(p.getY(i)*1e6)/1e6,z=Math.round(p.getZ(i)*1e6)/1e6;
      const wear=bevel?0.003:0;
      p.setXYZ(i,x+wear*Math.sin(y*31+z*17+seed),y+wear*Math.sin(x*23+z*29+seed),z+offset+wear*Math.sin(x*19+y*37+seed));
    }
    geometry.applyMatrix4(matrix);geometry.computeVertexNormals();
    const normal=geometry.attributes.normal,uv=geometry.attributes.uv,color=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
      if(nx>=ny&&nx>=nz)uv.setXY(i,z/1.15,y/1.15);else if(ny>=nz)uv.setXY(i,x/1.15,z/1.15);else uv.setXY(i,x/1.15,y/1.15);
      const damp=.58+.42*Math.min(1,Math.max(0,y)/1.15),grain=.86+.14*hash(x,y,z,seed),v=shade*damp*grain;
      color.push(v*.96,v*.98,v);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));parts.push(geometry);
  };
  const polygon=points=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;};
  const rectangle=(x0,y0,x1,y1)=>polygon([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  const wedge=(start,end,inner,outer)=>{
    const points=[],steps=Math.max(2,Math.ceil((end-start)/.08));
    for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;points.push([outer*Math.cos(a),spring+outer*Math.sin(a)]);}
    for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;points.push([inner*Math.cos(a),spring+inner*Math.sin(a)]);}
    return polygon(points);
  };
  // Recessed dark backing fills the joints without covering the passage.
  add(wedge(0,Math.PI,radius+.012,radius+.38),.055,.19,.025,0);
  for(const sign of [-1,1]){
    const a=sign*(radius+.015),b=sign*(radius+.39);
    add(rectangle(Math.min(a,b),.008,Math.max(a,b),spring+.02),.055,.19,.025,0);
    let y=0,row=0;
    while(y<spring-.01){
      const h=Math.min(.30+.10*hash(sign,row,0,seed),spring-y),width=.31+.035*hash(sign,row,1,seed);
      const inner=sign*(radius+.020),outer=sign*(radius+width);
      add(rectangle(Math.min(inner,outer),y+.009,Math.max(inner,outer),y+h-.009),.49+.018*hash(sign,row,2,seed),.64+.09*hash(sign,row,3,seed));
      y+=h;row++;
    }
    const inner=sign*(radius+.019),outer=sign*(radius+.43);
    add(rectangle(Math.min(inner,outer),spring-.045,Math.max(inner,outer),spring+.075),.52,.68);
  }
  const count=13;
  for(let i=0;i<count;i++){
    const key=i===(count-1)/2,outer=radius+.32+(key ? .065 : .018*hash(i,0,0,seed));
    add(wedge(i/count*Math.PI+.010,(i+1)/count*Math.PI-.010,radius+.022,outer),key ? .535 : .495,.65+.08*hash(i,1,0,seed));
  }
  const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();geometry.computeBoundingSphere();
  const material=stone.clone();material.vertexColors=true;material.color.setRGB(.48,.45,.41);material.roughness=1;material.normalScale?.set(1.25,1.25);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='conci-arco-consumati';group.add(mesh);
  return group;
}
