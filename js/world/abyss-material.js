// Local material copies: descending surfaces dissolve into the starless dark
// before revealing the stars below. No alpha sorting, extra maps or screen pass.
export function abyssMaterial(source,uniforms,winged=false){
  const material=source.clone(),compile=source.onBeforeCompile.bind(source),key=source.customProgramCacheKey();
  material.uniforms={...source.uniforms,...uniforms};
  if(source.userData.ageFloor)material.userData.ageFloor=source.userData.ageFloor;
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);Object.assign(shader.uniforms,uniforms);
    if(winged)shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float bridgeWing; varying float vBridgeWing; varying vec2 vAbyssXZ;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBridgeWing=bridgeWing;vAbyssXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+(winged?`
      varying vec2 vAbyssXZ;varying float vBridgeWing;uniform float uAbyssReduced,uAbyssLeft,uAbyssRight;
      float abyssHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float abyssNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(abyssHash(i),abyssHash(i+vec2(1,0)),f.x),mix(abyssHash(i+vec2(0,1)),abyssHash(i+vec2(1,1)),f.x),f.y);}
      `:'uniform float uAbyssDepth;'))
      // Reject consumed pixels before texture samples, ageing and PBR lighting.
      // Floor overlays use the same world-space pattern, so their holes align.
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        ${winged?'float abyssDepth=vBridgeWing<-.5?uAbyssLeft:(vBridgeWing>.5?uAbyssRight:0.0);':'float abyssDepth=uAbyssDepth;'}
        if(abyssDepth>=5.2)discard;
        ${winged?`float abyssEdge=1.0;
          if(uAbyssReduced<.5&&abyssDepth>1.0){
            float grain=abyssHash(floor(vAbyssXZ*9.0));
            float pattern=.13+.74*(abyssNoise(vAbyssXZ*1.6)*.9+grain*.1);
            abyssEdge=pattern-smoothstep(1.0,6.0,abyssDepth);
            if(abyssEdge<0.0)discard;
          }`:''}`)
      .replace('#include <opaque_fragment>',`
        float abyssFade=smoothstep(1.8,5.2,abyssDepth);
        outgoingLight*=pow(1.0-abyssFade,2.0);
        ${winged?`outgoingLight*=mix(.18,1.0,smoothstep(0.0,.16,abyssEdge));
          outgoingLight+=vec3(.026,.012,.055)*(1.0-smoothstep(0.0,.035,abyssEdge));`:''}
        if(abyssFade>.999)discard;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+(winged?':abyss-wing-v2':':abyss-prop-v2');
  return material;
}
