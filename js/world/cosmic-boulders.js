// Static fractured boulders, built once and merged into the existing rock draw.
// Reuse the terrain albedo with face projections so vertical sides retain detail.
import * as THREE from 'three';

export function createCosmicBoulders({terrainGeometry,x,z,groundTint,uvScale}) {
  const models=[
    [6.0,-2.4,1.4,1.0,.58,.35,7],
    [15.1,-.35,1.7,.72,.56,.12,19],
    [15.6,-2.0,2.2,1.45,1.05,.18,31],
    [15.1,.85,1.6,1.0,.82,-.27,43],
    [18.6,-5.0,2.4,1.5,.86,.50,59],
    [8.0,3.5,.95,.72,.46,-.70,71],
  ];
  const support=new THREE.Mesh(terrainGeometry),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  support.updateMatrixWorld(true);
  const ground=(wx,wz)=>{
    ray.set(new THREE.Vector3(wx,100,wz),down);
    const hit=ray.intersectObject(support)[0];
    if(!hit)throw new Error('Cosmic boulder outside terrain');
    return hit.point.y;
  };
  const pieces=[];
  for(const [ox,oz,width,depth,height,angle,seed]of models){
    const cx=x+ox,cz=z+oz,g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position;
    const cuts=[[0,-1,0,.62],[.66,.52,.24,.74],[-.78,.18,.26,.76],[.18,.25,-.84,.73],[-.16,.94,-.22,.84]]
      .map(([nx,ny,nz,d])=>({normal:new THREE.Vector3(nx,ny,nz).normalize(),distance:d+.035*Math.sin(seed+d*17)}));
    let low=Infinity,high=-Infinity;
    for(let i=0;i<p.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(p,i),n=Math.sin(v.x*12.99+v.y*78.23+v.z*37.71+seed)*43758.5453;
      let radius=.92+.12*(n-Math.floor(n));
      for(const cut of cuts){const dot=cut.normal.dot(v);if(dot>0)radius=Math.min(radius,cut.distance/dot);}
      v.multiplyScalar(radius);low=Math.min(low,v.y);high=Math.max(high,v.y);
      p.setXYZ(i,v.x+v.y*.10*Math.sin(seed),v.y,v.z-v.y*.08*Math.cos(seed));
    }
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*width/2,(p.getY(i)-low)/(high-low)*height,p.getZ(i)*depth/2);
    g.rotateY(angle);g.computeBoundingBox();
    const b=g.boundingBox;
    // The base is slightly buried below the rendered ground at its footprint.
    const base=Math.min(ground(cx,cz),...[
      [b.min.x,b.min.z],[b.min.x,b.max.z],[b.max.x,b.min.z],[b.max.x,b.max.z],
    ].map(([dx,dz])=>ground(cx+dx,cz+dz)))-.065;
    const colors=[],uv=[];
    for(let i=0;i<p.count;i++){
      const localY=p.getY(i),shade=groundTint(cx+p.getX(i),cz+p.getZ(i))*(.52+.48*Math.min(1,localY/(height*.55)));
      colors.push(.50*shade,.51*shade,.54*shade);
    }
    g.translate(cx,base,cz);g.computeVertexNormals();
    const normal=g.attributes.normal;
    for(let i=0;i<p.count;i+=3){
      const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
      for(let j=0;j<3;j++){
        const k=i+j;
        if(ny>=nx&&ny>=nz)uv.push(p.getX(k)/uvScale[0],p.getZ(k)/uvScale[1]);
        else if(nx>=nz)uv.push(p.getZ(k)/uvScale[0],p.getY(k)/uvScale[1]);
        else uv.push(p.getX(k)/uvScale[0],p.getY(k)/uvScale[1]);
      }
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeBoundingSphere();pieces.push(g);
  }
  support.material.dispose();
  return pieces;
}
