// Twelve distant tongues, in one draw. Anchors lie on the molten/crust
// boundary of the existing lava map; actual terrain triangles supply height.
import * as THREE from 'three';

export function createLavaFire({ terrainGeometry, fields, x, z, reduced = false }) {
  const anchors = [], phases = [], shapes = [];
  const edgeUV = [[.18514,.82008],[.43155,.60365],[.62581,.37940],[.78879,.16167]];
  const support = new THREE.Mesh(terrainGeometry), ray = new THREE.Raycaster();
  support.updateMatrixWorld(true); ray.ray.direction.set(0, -1, 0);
  fields.forEach(([ox, oz, width, depth, angle], field) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    edgeUV.forEach(([tu, tv], i) => {
      const u = field === 1 ? 1 - tu : tu, v = field === 2 ? 1 - tv : tv;
      const dx = (u - .5) * width, dz = (v - .5) * depth;
      const wx = x + ox + dx * c - dz * s, wz = z + oz + dx * s + dz * c;
      ray.ray.origin.set(wx, 100, wz); const hit = ray.intersectObject(support)[0];
      if (!hit) return;
      anchors.push(wx, hit.point.y + .013, wz); phases.push((field * 4 + i) * 2.39996);
      shapes.push(.16 + ((i * 3 + field) % 5) * .028, .13 + ((i + field * 2) % 4) * .035);
    });
  });
  support.material.dispose();
  const plane = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index; geometry.setAttribute('position', plane.attributes.position); geometry.setAttribute('uv', plane.attributes.uv);
  geometry.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(new Float32Array(anchors), 3));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
  geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shapes), 2));
  geometry.instanceCount = phases.length;
  const uniforms = { uTime: { value: 0 }, uLevel: { value: 1 }, uMotion: { value: reduced ? 0 : 1 } };
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, depthTest: true, fog: false, toneMapped: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aAnchor; attribute vec2 aShape; attribute float aPhase;
      uniform float uTime, uMotion; varying vec2 vUv; varying float vPhase;
      void main(){
        float t=uTime*uMotion, pulse=.72+.18*sin(t*(2.1+mod(aPhase,.6))+aPhase)+.10*sin(t*4.3+aPhase*1.7);
        float tall=pow(max(0.0,sin(t*(.42+mod(aPhase,.17))+aPhase*1.61)),14.0)*uMotion;
        float h=aShape.y*pulse+tall*.44;
        vec4 p=modelViewMatrix*vec4(aAnchor,1.0);
        p.x+=position.x*aShape.x+sin(t*2.0+aPhase+uv.y*3.2)*uv.y*uv.y*.045*uMotion;
        p.y+=uv.y*h; gl_Position=projectionMatrix*p; vUv=uv; vPhase=aPhase;
      }`,
    fragmentShader: `uniform float uTime,uLevel,uMotion; varying vec2 vUv; varying float vPhase;
      void main(){
        float t=uTime*uMotion, y=vUv.y;
        float centre=.5+sin(t*2.3+vPhase+y*5.0)*y*.095;
        float width=(1.0-y)*(.35+.065*sin(y*10.0-t*3.0+vPhase));
        float a=(1.0-smoothstep(width*.38,width,abs(vUv.x-centre)))*smoothstep(0.0,.16,y)*(1.0-smoothstep(.64,1.0,y));
        vec3 colour=mix(vec3(1.0,.53,.055),vec3(.82,.055,.001),y);
        gl_FragColor=vec4(colour,a*uLevel*.64);
        #include <colorspace_fragment>
      }`,
  });
  const flames = new THREE.Mesh(geometry, material); flames.name = 'cosmo-fiammelle-lava'; flames.frustumCulled = false;
  return { flames, anchors: geometry.attributes.aAnchor, count: phases.length,
    update(time) { uniforms.uTime.value = time; },
    setBrightness(v) { const level = Math.max(0, v); uniforms.uLevel.value = level; flames.visible = level > .001; },
  };
}
