import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { FOLD } from './path.js';

// No production room/event is instantiated. Only its existing asset resources.
export async function createCorridor(scene,path,manager) {
  const root=new THREE.Group(); root.name='space-fold-reparto'; scene.add(root);
  const gltf=new GLTFLoader(manager), textures=new THREE.TextureLoader(manager);
  const [wallAsset,doorAsset,lampAsset,floorMap,ceilingMap]=await Promise.all([
    gltf.loadAsync('assets/models/mg_wall.glb'),
    gltf.loadAsync('assets/models/hw_door_1.glb'),
    gltf.loadAsync('assets/models/wlamp.glb'),
    textures.loadAsync('assets/tex/mg_floor.jpg'),
    textures.loadAsync('assets/tex/ward_ceiling.jpg'),
  ]);
  const deformables=[],anchors=[],frame={};
  let stationS=null,stationFrames=null;
  const wallMat=wallAsset.scene.children[0].material?.clone() ?? (()=>{
    let m; wallAsset.scene.traverse(o=>{if(o.isMesh&&!m)m=o.material.clone();});return m;
  })();
  wallMat.color.setScalar(.62); wallMat.roughness=.78; wallMat.side=THREE.FrontSide;
  for(const texture of [floorMap,ceilingMap]) {
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=2;
  }
  const floorMat=new THREE.MeshStandardMaterial({map:floorMap,color:0x9a9e93,roughness:.69});
  const ceilingMat=new THREE.MeshStandardMaterial({map:ceilingMap,color:0xa4aaa0,roughness:.9});
  const darkMetal=new THREE.MeshStandardMaterial({color:0x393d34,roughness:.88,metalness:.35});
  const lightStrip=new THREE.MeshStandardMaterial({color:0xbacbbb,emissive:0x8fc6af,emissiveIntensity:1.2});

  function register(geo,material,name) {
    geo.normalizeNormals();
    const pos=geo.getAttribute('position'),norm=geo.getAttribute('normal');
    const mesh=new THREE.Mesh(geo,material);mesh.name=name;
    // A single small tunnel is intentionally one culling unit while deforming.
    mesh.frustumCulled=false; root.add(mesh);
    // Imported/rest-pose bounds become invalid when the floor goes vertical.
    // Conservative bounds also keep ray tests correct without rescanning vertices.
    geo.boundingBox=new THREE.Box3(new THREE.Vector3(-3,-.5,-FOLD.length-.5),
      new THREE.Vector3(3,FOLD.length+FOLD.height,FOLD.height+.5));
    geo.boundingSphere=geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    pos.setUsage(THREE.DynamicDrawUsage);norm.setUsage(THREE.DynamicDrawUsage);
    deformables.push({geo,rest:pos.array.slice(),normals:norm.array.slice()});return mesh;
  }
  function surface(material,name,quads) {
    const p=[],n=[],uv=[];
    const add=(v,normal,u)=>{p.push(...v);n.push(...normal);uv.push(...u);};
    for(const {v,normal,u} of quads) for(const i of [0,1,2,0,2,3]) add(v[i],normal,u[i]);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return register(g,material,name);
  }
  const floor=[],ceil=[],left=[],right=[],step=.125,half=FOLD.width/2;
  // Exact original mg_wall front profile and atlas UVs, cropped at ward ceiling.
  const profile=[[0,.112,.919902],[1.4985,.112,.51354],[1.5015,.125,.509673],
    [1.5135,.125,.506416],[1.5265,.135,.501887],[1.5585,.135,.49320],
    [1.5815,.100,.480999],[2.5,.100,.231675]];
  for(let s=0;s<FOLD.length-1e-6;s+=step) {
    const b=Math.min(FOLD.length,s+step);
    floor.push({v:[[-half,0,-s],[half,0,-s],[half,0,-b],[-half,0,-b]],normal:[0,1,0],
      u:[[0,s/1.5],[FOLD.width/1.5,s/1.5],[FOLD.width/1.5,b/1.5],[0,b/1.5]]});
    ceil.push({v:[[-half,FOLD.height,-s],[-half,FOLD.height,-b],[half,FOLD.height,-b],[half,FOLD.height,-s]],normal:[0,-1,0],
      u:[[0,s/.75],[0,b/.75],[FOLD.width/3,b/.75],[FOLD.width/3,s/.75]]});
    const u0=.0078125+((s%3)/3)*.814354, u1=u0+(b-s)/3*.814354;
    for(let k=0;k<profile.length-1;k++) {
      const [y0,d0,v0]=profile[k], [y1,d1,v1]=profile[k+1];
      for(const sign of [-1,1]) {
        const x0=sign*(half-.115-d0),x1=sign*(half-.115-d1);
        let v=[[x0,y0,-s],[x0,y0,-b],[x1,y1,-b],[x1,y1,-s]],
          u=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
        const nn=new THREE.Vector3(-sign*(y1-y0),sign*(x1-x0),0).normalize();
        if(sign===1) {v=v.reverse();u=u.reverse();}
        (sign<0?left:right).push({v,normal:[nn.x,nn.y,0],u});
      }
    }
  }
  surface(floorMat,'pavimento-parametrico',floor);
  surface(ceilingMat,'soffitto-parametrico',ceil);
  surface(wallMat,'parete-piastrelle-sinistra',left);
  surface(wallMat,'parete-piastrelle-destra',right);

  // Bake the real ward doors into rest coordinates, subdividing along the path.
  // They bend with the jamb instead of detaching from a curved wall.
  function bakeDoor(x,s,ry) {
    const o=doorAsset.scene.clone(true);o.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(o), size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
    const scale=2.10/size.y;
    const matrix=new THREE.Matrix4().makeTranslation(x,0,-s)
      .multiply(new THREE.Matrix4().makeRotationY(ry))
      .multiply(new THREE.Matrix4().makeScale(scale,scale,scale))
      .multiply(new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z));
    o.traverse(m=>{
      if(!m.isMesh)return;
      const geo=m.geometry.clone().applyMatrix4(matrix.clone().multiply(m.matrixWorld));
      const mat=m.material.clone();mat.color.multiplyScalar(.38);mat.roughness=Math.max(.7,mat.roughness);
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\nfloat grey=dot(diffuseColor.rgb,vec3(.30,.59,.11)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(grey)*vec3(.94,1.0,.95),.65);');
      };
      mat.customProgramCacheKey=()=>'space-fold-aged-door-v1';
      register(subdivide(geo,.12),mat,'porta-reparto-ancorata');geo.dispose();
    });
  }
  bakeDoor(-1.72,7.5,Math.PI/2);bakeDoor(1.72,13,-Math.PI/2);
  // Terminal door is a physical end to the isolated vestibule, not a teleport.
  bakeDoor(0,FOLD.length-.04,0);
  // Simple transverse jamb above the final door, transported with the landing.
  const end=new THREE.Group();
  for(const x of [-1.52,1.52]) {const m=new THREE.Mesh(new THREE.BoxGeometry(1,2.5,.15),wallMat);m.position.set(x,1.25,0);end.add(m);}
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(2.1,.35,.16),darkMetal);lintel.position.y=2.33;end.add(lintel);
  root.add(end);anchors.push({object:end,x:0,y:0,s:FOLD.length});

  const lampPositions=[];
  for(const [i,s] of [2.5,8.0,13.5,19.5,23].entries()) {
    const mount=new THREE.Group();mount.name='lampada-ancorata-'+i;
    const fixture=lampAsset.scene.clone(true);
    fixture.traverse(m=>{
      if(!m.isMesh)return;
      const original=m.material;
      // Avoid the imported transmission material's additional full-scene pass.
      m.material=new THREE.MeshStandardMaterial({map:original.map,normalMap:original.normalMap,
        roughnessMap:original.roughnessMap,color:0x909c8c,roughness:.72,metalness:.25,
        emissiveMap:original.emissiveMap,emissive:original.emissiveMap?0xa3d3ba:0x000000,
        emissiveIntensity:1.2,side:THREE.DoubleSide});
    });
    // Original wall fixture used as a ceiling bulkhead; light faces into corridor.
    fixture.rotation.x=Math.PI/2;fixture.scale.set(1.2,2.0,1.2);mount.add(fixture);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.62),lightStrip);bar.position.y=-.13;mount.add(bar);
    root.add(mount);anchors.push({object:mount,x:0,y:2.37,s});lampPositions.push({x:0,y:2.22,s});
  }
  // A pair of narrow rusty service conduits is part of the deforming shell.
  const pipeMat=new THREE.MeshStandardMaterial({color:0x33372d,roughness:.9,metalness:.45});
  const pipes=[];
  for(const x of [-1.43,1.43]) for(let s=0;s<FOLD.length;s+=step) {
    const d=.022,y=2.40;
    pipes.push({v:[[x-d,y,-s],[x-d,y,-s-step],[x+d,y,-s-step],[x+d,y,-s]],normal:[0,-1,0],u:[[0,0],[0,1],[1,1],[1,0]]});
  }
  surface(pipeMat,'condotte-soffitto',pipes);

  function update() {
    if(!stationS) {
      // Thousands of shell vertices share the same longitudinal stations.
      // Evaluate trigonometry/integration lookups once per station, not per vertex.
      const ids=new Map(),positions=[];
      for(const d of deformables) {
        d.stations=new Uint32Array(d.rest.length/3);
        for(let i=0;i<d.rest.length;i+=3) {
          const s=-d.rest[i+2];let id=ids.get(s);
          if(id===undefined){id=positions.length;ids.set(s,id);positions.push(s);}
          d.stations[i/3]=id*5;
        }
      }
      stationS=new Float64Array(positions);stationFrames=new Float64Array(positions.length*5);
    }
    for(let i=0;i<stationS.length;i++) {
      path.frame(stationS[i],frame);const k=i*5;
      stationFrames[k]=frame.y;stationFrames[k+1]=frame.z;
      stationFrames[k+2]=frame.cos;stationFrames[k+3]=frame.sin;stationFrames[k+4]=frame.curvature;
    }
    for(const {geo,rest,normals,stations} of deformables) {
      const p=geo.attributes.position.array,n=geo.attributes.normal.array;
      for(let i=0;i<rest.length;i+=3) {
        const y=rest[i+1],k=stations[i/3],cos=stationFrames[k+2],sin=stationFrames[k+3];
        p[i]=rest[i];p[i+1]=stationFrames[k]+y*cos;p[i+2]=stationFrames[k+1]+y*sin;
        // Inverse transpose of the actual deformation Jacobian.
        const nx=normals[i],ny=normals[i+1],nz=normals[i+2]/Math.max(.15,1-y*stationFrames[k+4]);
        const inv=normals[i+2]===0?1:1/Math.hypot(nx,ny,nz);
        n[i]=nx*inv;n[i+1]=(ny*cos-nz*sin)*inv;n[i+2]=(ny*sin+nz*cos)*inv;
      }
      geo.attributes.position.needsUpdate=true;geo.attributes.normal.needsUpdate=true;
    }
    for(const a of anchors) {
      path.point(a.x,a.y,a.s,frame);a.object.position.set(frame.x,frame.y,frame.z);a.object.rotation.x=frame.theta;
    }
  }
  update();
  return {root,update,anchors,lampPositions,deformables};
}

// Split imported triangles by s slices, interpolating normals and UVs. Existing
// low-poly doors otherwise have too few longitudinal vertices to follow a bend.
function subdivide(source,step) {
  const geo=source.index?source.toNonIndexed():source.clone();
  const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  const outP=[],outN=[],outU=[];
  const vertex=i=>({p:[p.getX(i),p.getY(i),p.getZ(i)],n:[n.getX(i),n.getY(i),n.getZ(i)],u:[uv.getX(i),uv.getY(i)]});
  function clip(poly,z,keepAbove) {
    const result=[];let a=poly[poly.length-1];
    for(const b of poly) {
      const ai=keepAbove?a.p[2]>=z:a.p[2]<=z,bi=keepAbove?b.p[2]>=z:b.p[2]<=z;
      if(ai!==bi) {
        const t=(z-a.p[2])/(b.p[2]-a.p[2]),v={};
        for(const key of ['p','n','u'])v[key]=a[key].map((x,i)=>x+(b[key][i]-x)*t);
        result.push(v);
      }
      if(bi)result.push(b);a=b;
    }return result;
  }
  for(let i=0;i<p.count;i+=3) {
    const tri=[vertex(i),vertex(i+1),vertex(i+2)],lo=Math.min(...tri.map(v=>v.p[2])),hi=Math.max(...tri.map(v=>v.p[2]));
    for(let j=Math.floor(lo/step);j<=Math.floor(hi/step);j++) {
      let poly=clip(tri,j*step,true);if(poly.length<3)continue;
      poly=clip(poly,(j+1)*step,false);
      for(let k=1;k+1<poly.length;k++)for(const v of [poly[0],poly[k],poly[k+1]]) {outP.push(...v.p);outN.push(...v.n);outU.push(...v.u);}
    }
  }
  geo.dispose();const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(outP,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(outN,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(outU,2));return result;
}
