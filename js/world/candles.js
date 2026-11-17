import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';
import { addContactShadow } from './contact-shadows.js';

// Cera, stoppini e fiamme raggruppati: tre draw call per tutte le candele.
export function createCandles(parent, placements) {
  const waxParts = [], wickParts = [], seeds = [];
  let seed = 371; const rnd = () => ((seed = (seed*1664525+1013904223)>>>0)/4294967296);
  const put = (geo, x,y,z, tint) => {
    geo.translate(x,y,z); const colors = [];
    for (let i=0;i<geo.attributes.position.count;i++) colors.push(tint,tint*.96,tint*.88);
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); waxParts.push(geo);
  };
  const flameGeo = new THREE.PlaneGeometry(1,1), flameMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true, toneMapped:false,
    uniforms:{time:{value:0}},
    vertexShader:`attribute float candleSeed; uniform float time; varying vec2 vUv;
      void main(){ vUv=uv; vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        vec2 p=position.xy*size; float t=time*3.1+candleSeed;
        p.y*=.97+.03*sin(t*2.3); p.x+=sin(t+uv.y*2.8)*.0018*uv.y*uv.y;
        gl_Position=projectionMatrix*(center+vec4(p,0.,0.)); }`,
    fragmentShader:`varying vec2 vUv;
      void main(){float h=vUv.y; float width=.43*pow(max(0.,1.-h),.7)*smoothstep(0.,.22,h)+.008;
        float edge=abs(vUv.x-.5)/width; float a=(1.-smoothstep(.55,1.,edge))*smoothstep(0.,.07,h)*(1.-smoothstep(.92,1.,h));
        if(a<.015)discard; float core=(1.-smoothstep(.1,.75,edge))*(1.-smoothstep(.3,.8,h));
        gl_FragColor=vec4(mix(vec3(1.,.40,.065),vec3(1.,.91,.60),core),a*.92);
        #include <colorspace_fragment>
      }`,
  });
  const flames = new THREE.InstancedMesh(flameGeo,flameMat,placements.length); flames.name='fiamme-candele';
  const matrix = new THREE.Matrix4();
  placements.forEach(([x,y,z,h],index)=>{
    const tint=.76+rnd()*.24, phase=rnd()*6.28;
    const body = new THREE.LatheGeometry([[0,0],[.033,0],[.036,.008],[.034,h*.35],[.030,h-.013],[.027,h],[.019,h-.009],[.007,h-.013],[0,h-.013]].map(([r,yy])=>new THREE.Vector2(r,yy)),12);
    const p=body.attributes.position;
    for(let i=0;i<p.count;i++){
      const yy=p.getY(i), angle=Math.atan2(p.getZ(i),p.getX(i));
      if(yy>h-.025) p.setY(i,yy+(Math.sin(angle*3+phase)*.0015+Math.sin(angle*5-phase)*.001)*Math.min(1,(yy-h+.025)/.025));
    }
    body.computeVertexNormals(); put(body,x,y,z,tint);
    for(let j=0;j<3;j++){
      const a=phase+j*2.17, len=.025+rnd()*Math.min(.10,h*.55), radius=.0305;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a)*.027,h-.003,Math.sin(a)*.027),new THREE.Vector3(Math.cos(a+.025)*radius,h-len*.5,Math.sin(a+.025)*radius),new THREE.Vector3(Math.cos(a)*radius,h-len,Math.sin(a)*radius)]);
      put(new THREE.TubeGeometry(curve,5,.0025+rnd()*.001,4,false),x,y,z,tint*.96);
      const drop=new THREE.SphereGeometry(.004,6,4); drop.scale(1,1.4,1); put(drop,x+Math.cos(a)*radius,y+h-len,z+Math.sin(a)*radius,tint*.96);
    }
    const pool=new THREE.CircleGeometry(y>1?.056:.045,16).rotateX(-Math.PI/2), pp=pool.attributes.position;
    for(let i=1;i<pp.count;i++){const a=Math.atan2(pp.getZ(i),pp.getX(i)),k=.97+.08*Math.sin(a*3+phase)+.045*Math.sin(a*5-phase);pp.setXYZ(i,pp.getX(i)*k,.001,pp.getZ(i)*k);}
    put(pool,x,y+.0007,z,tint*.87);
    const wick=new THREE.CylinderGeometry(.0015,.0018,.012,4);wick.translate(x,y+h-.002,z);wickParts.push(wick);
    const fh=.047+rnd()*.013, fw=.020+rnd()*.006;
    matrix.makeScale(fw,fh,1);matrix.setPosition(x,y+h+.004+fh/2,z);flames.setMatrixAt(index,matrix);seeds.push(phase+index*.7);
    addContactShadow(parent,{x,y,z,w:.11,d:.10,strength:.20});
  });
  const wax = new THREE.Mesh(mergeGeometries(waxParts,false),new THREE.MeshStandardMaterial({color:0x29231d,roughness:.86,vertexColors:true}));wax.name='cera-consumata-candele';parent.add(wax);
  const wicks = new THREE.Mesh(mergeGeometries(wickParts,false),new THREE.MeshBasicMaterial({color:0x100b07}));wicks.name='stoppini-candele';parent.add(wicks);
  waxParts.forEach(g=>g.dispose());wickParts.forEach(g=>g.dispose());
  flameGeo.setAttribute('candleSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),1));flames.computeBoundingSphere();parent.add(flames);
  return {update(time){flameMat.uniforms.time.value=time;},count:placements.length};
}
