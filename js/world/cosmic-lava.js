// Lava decals follow the actual terrain triangles, including distant relief.
// One batched draw and one albedo/alpha map; no simulation or extra lights.
import * as THREE from 'three';

export function createCosmicLava({terrainGeometry,map,x,z}) {
  const position=terrainGeometry.attributes.position,index=terrainGeometry.index;
  const positions=[],uv=[];
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
  for(const [ox,oz,width,depth,angle]of fields){
    const cx=x+ox,cz=z+oz,c=Math.cos(angle),s=Math.sin(angle);
    for(let i=0;i<index.count;i+=3){
      let polygon=[];
      for(let j=0;j<3;j++){
        const k=index.getX(i+j),wx=position.getX(k),wy=position.getY(k),wz=position.getZ(k),dx=wx-cx,dz=wz-cz;
        polygon.push([wx,wy,wz,(dx*c+dz*s)/width+.5,(-dx*s+dz*c)/depth+.5]);
      }
      for(const [axis,bound,sign]of [[3,0,1],[3,1,-1],[4,0,1],[4,1,-1]])polygon=clip(polygon,axis,bound,sign);
      for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
        positions.push(v[0],v[1]+.006,v[2]);uv.push(v[3],v[4]);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.02,depthWrite:false,fog:false,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='cosmo-lava-incandescente';
  return {mesh,setBrightness(v){material.color.setScalar(v*1.15);}};
}
