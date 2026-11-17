// Usura della carta in 3D: conserva le immagini originali nell'atlante.
// UV locali per foglio: niente bruciature che attraversano le celle vicine.
export function wornPaper(material) {
  material.alphaTest = 0.45;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 paperUv; attribute float paperSeed; varying vec2 vPaperUv; varying float vPaperSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaperUv = paperUv; vPaperSeed = paperSeed;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vPaperUv; varying float vPaperSeed;
float wpHash(vec2 p) { p = fract(p * vec2(0.1031,0.1030)); p += dot(p,p.yx+33.33); return fract((p.x+p.y)*p.x); }
float wpNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wpHash(i), wpHash(i+vec2(1,0)), f.x), mix(wpHash(i+vec2(0,1)), wpHash(i+vec2(1,1)), f.x), f.y);
}
float wpFbm(vec2 p) { return wpNoise(p)*0.57 + wpNoise(p*2.13+3.7)*0.28 + wpNoise(p*4.73+7.1)*0.15; }
`).replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 uv = vPaperUv, id = vec2(vPaperSeed * 3.17, vPaperSeed * 1.91);
  float mottled = wpFbm(uv * 7.0 + id), grain = wpNoise(uv * 190.0 + id);
  float edge = min(min(uv.x, 1.0-uv.x)*0.667, min(uv.y, 1.0-uv.y));
  float rag = 0.002 + 0.004*wpNoise(uv*113.0+id) + 0.009*wpNoise(uv*31.0-id) + 0.014*pow(wpNoise(uv*13.0+id),3.0);
  float distanceToPaper = edge-rag;
  // Una porzione irregolare del bordo inferiore manca davvero: il muro resta visibile.
  vec2 corner = vec2(step(0.5, fract(vPaperSeed*0.618)), 0.0);
  float bite = 0.065 + 0.065*fract(vPaperSeed*0.37);
  float cornerEdge = length((uv-corner)*vec2(0.667,1.0))-bite*(0.78+0.35*wpNoise(uv*37.0+id));
  distanceToPaper = min(distanceToPaper, cornerEdge);
  diffuseColor.a *= smoothstep(0.0, 0.0025, distanceToPaper);

  // Inchiostro sbiadito, carta ocra, fibre e macchie da umidita'.
  vec3 printColor = diffuseColor.rgb;
  float luminance = dot(printColor,vec3(0.299,0.587,0.114));
  vec3 yellowed = vec3(luminance)*vec3(1.0,0.80,0.53);
  printColor = mix(printColor,yellowed,0.38+0.13*fract(vPaperSeed*0.23));
  printColor = printColor*(0.74+0.17*mottled) + vec3(0.018,0.012,0.006);
  printColor *= 0.94+0.10*grain;
  float foxing = smoothstep(0.65,0.88,wpNoise(uv*39.0+id)*0.55+wpNoise(uv*83.0-id)*0.30+mottled*0.15);
  printColor = mix(printColor,printColor*vec3(0.39,0.29,0.15),foxing*0.50);
  float soot = smoothstep(0.56,0.82,wpFbm(uv*4.0-id)+uv.y*0.14);
  printColor = mix(printColor,vec3(0.024,0.018,0.011),soot*0.38);
  // Aloni con una linea di marea, non un velo uniforme marrone.
  vec2 wetCenter = vec2(0.16+0.68*fract(vPaperSeed*0.71),0.16);
  float wet = length((uv-wetCenter)*vec2(1.0,0.72)) + (mottled-0.5)*0.09;
  float tide = 1.0-smoothstep(0.004,0.018,abs(wet-0.42));
  printColor *= 1.0-0.32*tide;
  // Vecchie pieghe: solco scuro e fibra chiara sul labbro della piega.
  float foldX = 0.29+0.34*fract(vPaperSeed*0.43), foldY = 0.32+0.31*fract(vPaperSeed*0.61);
  float crease = max(1.0-smoothstep(0.001,0.007,abs(uv.x-foldX)),1.0-smoothstep(0.001,0.005,abs(uv.y-foldY)));
  float lip = max(1.0-smoothstep(0.0005,0.0025,abs(uv.x-foldX-0.005)),1.0-smoothstep(0.0005,0.0025,abs(uv.y-foldY-0.004)));
  printColor = printColor*(1.0-0.25*crease) + vec3(0.035,0.025,0.013)*lip*smoothstep(0.15,0.7,mottled);
  float burnWidth = (0.5+0.8*fract(vPaperSeed*0.317)) * (0.55+0.6*(1.0-uv.y)+0.3*uv.x*fract(vPaperSeed*0.71));
  float scorch = 1.0-smoothstep(0.006,0.057,distanceToPaper/burnWidth);
  float carbon = 1.0-smoothstep(0.001,0.021,distanceToPaper/burnWidth);
  printColor = mix(printColor,vec3(0.16,0.068,0.021),scorch*0.72);
  diffuseColor.rgb = mix(printColor,vec3(0.014,0.008,0.004),carbon*0.98);
}
`);
  };
  material.customProgramCacheKey = () => 'worn-film-paper-v1';
  return material;
}
