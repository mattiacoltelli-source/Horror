// Local material copies: descending surfaces dissolve into the starless dark
// before revealing the stars below. No alpha sorting, extra maps or screen pass.
export function abyssMaterial(source,uniforms,winged=false){
  const material=source.clone(),compile=source.onBeforeCompile.bind(source),key=source.customProgramCacheKey();
  material.uniforms={...source.uniforms,...uniforms};
  if(source.userData.ageFloor)material.userData.ageFloor=source.userData.ageFloor;
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);Object.assign(shader.uniforms,uniforms);
    if(winged)shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float bridgeWing; varying float vBridgeWing;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBridgeWing=bridgeWing;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+(winged?'varying float vBridgeWing; uniform float uAbyssLeft,uAbyssRight;':'uniform float uAbyssDepth;'))
      .replace('#include <opaque_fragment>',`${winged?'float abyssDepth=vBridgeWing<-.5?uAbyssLeft:(vBridgeWing>.5?uAbyssRight:0.0);':'float abyssDepth=uAbyssDepth;'}
        float abyssFade=smoothstep(1.8,5.2,abyssDepth);
        outgoingLight*=pow(1.0-abyssFade,2.0);
        if(abyssFade>.999)discard;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+(winged?':abyss-wing-v1':':abyss-prop-v1');
  return material;
}
