// Original photo filters. Pixi's standard filter vertex transform keeps input
// coordinates correct when its temporary textures are larger than the tile.
export const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  gl_Position = vec4(p.x * 2.0 / uOutputTexture.x - 1.0,
    p.y * 2.0 * uOutputTexture.z / uOutputTexture.y - uOutputTexture.z, 0.0, 1.0);
  vTextureCoord = aPosition * uOutputFrame.zw * uInputSize.zw;
}`;

const common = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uOther;
uniform sampler2D uPerson;
uniform sampler2D uSkinMask;
uniform sampler2D uDepthMap;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec4 uShape;
uniform vec2 uTile;
uniform vec2 uPersonSize;
uniform vec2 uSkinSize;
uniform vec2 uDepthSize;
uniform vec3 uAvailable;
uniform vec4 uFocus;
uniform float uFocusMode;
uniform float uFocusDepth;
uniform vec2 uBorder;
uniform vec2 uSkin;
uniform vec4 uTone;
uniform float uVibrance;
uniform vec4 uFlare;
uniform float uFlareStyle;
uniform vec3 uBackground;
uniform float uOverlay;
uniform float uMix;
vec2 pixel() { return vTextureCoord * uInputSize.xy; }
vec2 globalUV() { return (pixel() + uShape.zw) / uShape.xy; }
vec2 localUV() { return pixel() / uTile; }
vec2 mapUV(vec2 uv, vec2 size) { return (clamp(uv, 0.0, 1.0) * (size - 1.0) + .5) / size; }
float personAt(vec2 uv) {
  return uAvailable.x * smoothstep(uBorder.x - uBorder.y, uBorder.x + uBorder.y, texture(uPerson, mapUV(uv,uPersonSize)).r);
}
float skinAt(vec2 uv) { return uAvailable.y * smoothstep(.15,.65,texture(uSkinMask,mapUV(uv,uSkinSize)).r); }
float depthAt(vec2 uv) { return texture(uDepthMap,mapUV(uv,uDepthSize)).r; }
float focusAt(vec2 uv) {
  if (uFocusMode < .5) return 0.0;
  if (uFocusMode < 1.5) return smoothstep(uFocus.z,uFocus.z+.2,length((uv-uFocus.xy)*uShape.xy/min(uShape.x,uShape.y)));
  if (uFocusMode < 2.5) return uAvailable.x * (1.0-personAt(uv));
  return uAvailable.z * smoothstep(uFocus.w,uFocus.w+.22,abs(depthAt(uv)-uFocusDepth));
}
vec3 straight(vec4 c) { return c.a > .0001 ? c.rgb/c.a : vec3(0.0); }
vec4 photo(vec3 rgb, float alpha) { return vec4(clamp(rgb,0.0,1.0)*alpha,alpha); }
`;

export const shaders = {
  skinWeight: `${common}
void main() { finalColor = texture(uTexture,vTextureCoord)*skinAt(globalUV()); }`,
  skinBlend: `${common}
void main() {
  vec4 c = texture(uTexture,vTextureCoord), soft = texture(uOther,localUV());
  vec3 rgb = mix(straight(c),soft.a>.005 ? straight(soft) : straight(c),skinAt(globalUV())*uSkin.x*.8);
  finalColor = photo(rgb+skinAt(globalUV())*uSkin.y*.3/255.0,c.a);
}`,
  tone: `${common}
void main() {
  vec4 c=texture(uTexture,vTextureCoord); vec3 rgb=straight(c);
  float l=dot(rgb,vec3(.2126,.7152,.0722));
  float tonal=uTone.y*.7*(1.0-smoothstep(.05,.65,l))+uTone.x*.7*smoothstep(.35,.95,l);
  rgb+=(vec3(uTone.z*.35+uTone.w*.15,-uTone.w*.2,-uTone.z*.35+uTone.w*.15)+tonal)/255.0;
  float chroma=max(max(rgb.r,rgb.g),rgb.b)-min(min(rgb.r,rgb.g),rgb.b);
  rgb=mix(vec3(dot(rgb,vec3(.2126,.7152,.0722))),rgb,1.0+uVibrance*(1.0-clamp(chroma,0.0,1.0)));
  finalColor=photo(rgb,c.a);
}`,
  softGlow: `${common}
void main() {
  vec4 c=texture(uTexture,vTextureCoord), soft=texture(uOther,localUV());
  vec3 rgb=straight(c), screened=1.0-(1.0-rgb)*(1.0-straight(soft));
  finalColor=photo(mix(rgb,screened,uMix),c.a);
}`,
  restoreAlpha: `${common}
void main() {
  vec4 c=texture(uTexture,vTextureCoord), original=texture(uOther,localUV());
  finalColor=photo(straight(c),original.a);
}`,
  focus: `${common}
void main() {
  vec4 original=texture(uTexture,vTextureCoord); vec2 uv=globalUV();
  float coc=focusAt(uv), radius=uMix*coc;
  if (radius < .25) { finalColor=original; return; }
  vec3 sum=vec3(0.0); float total=0.0;
  // A deterministic aperture disk. Reject focused foreground contributions
  // and renormalize to avoid colour halos around the person.
  for(int i=0;i<40;i++) {
    float fi=float(i), angle=fi*2.39996323;
    vec2 offset=vec2(cos(angle),sin(angle))*sqrt(fi/39.0)*radius;
    vec2 p=clamp(vTextureCoord+offset*uInputSize.zw,uInputClamp.xy,uInputClamp.zw);
    vec4 c=texture(uTexture,p); vec3 rgb=straight(c);
    float weight=focusAt((p*uInputSize.xy+uShape.zw)/uShape.xy)*c.a;
    weight*=1.0+max(max(max(rgb.r,rgb.g),rgb.b)-.7,0.0)*2.0;
    sum+=rgb*weight; total+=weight;
  }
  finalColor=photo(mix(straight(original),total>.001 ? sum/total : straight(original),coc),original.a);
}`,
  cutout: `${common}
void main() { finalColor=texture(uTexture,vTextureCoord)*personAt(globalUV()); }`,
  outlineOver: `${common}
void main() {
  vec4 c=texture(uTexture,vTextureCoord), line=texture(uOther,localUV());
  finalColor=line+c*(1.0-line.a);
}`,
  background: `${common}
void main() { vec4 c=texture(uTexture,vTextureCoord); finalColor=vec4(c.rgb+uBackground*(1.0-c.a),1.0); }`,
  overlay: `${common}
void main() {
  vec4 c=texture(uTexture,vTextureCoord); vec2 uv=globalUV();
  if(uOverlay>2.5) { finalColor=vec4(vec3(depthAt(uv)),1.0); return; }
  float m=uOverlay<1.5 ? skinAt(uv) : personAt(uv);
  finalColor=photo(mix(straight(c),vec3(0.0,.745,0.0),m*.6),c.a);
}`,
  flare: `${common}
float gaussian(float r,float falloff) { return exp(-r*r*falloff); }
float polygon(vec2 p,float sides) {
  float a=atan(p.y,p.x), sector=6.2831853/sides;
  return length(p)*cos(floor(.5+a/sector)*sector-a);
}
vec3 ghost(vec2 p,float r,vec3 tint,float intensity) {
  float d=polygon(p/r,6.0), roundD=length(p)/r;
  float disk=(1.0-smoothstep(.72,1.02,d))*.10;
  float edge=gaussian(roundD-.91,500.0)*.14;
  return tint*(disk+edge)*intensity;
}
void main() {
  vec4 c=texture(uTexture,vTextureCoord);
  vec2 aspect=uShape.xy/min(uShape.x,uShape.y), uv=(globalUV()-.5)*aspect;
  vec2 light=(uFlare.zw-.5)*aspect, p=uv-light;
  float size=.045+uFlare.y*.37, r=length(p)/size;
  // Warm veiling glare, a compact white core, spectral halo, and diffraction.
  vec3 glow=vec3(1.0,.70,.36)*(.28*gaussian(r,1.2)+.10*exp(-r*1.1));
  glow+=vec3(1.0,.95,.82)*gaussian(r,80.0)*.9;
  float ring=length(p)/(size*1.9);
  glow+=vec3(gaussian(ring-.98,220.0),gaussian(ring-1.0,240.0),gaussian(ring-1.025,260.0))*.045;
  if(uFlareStyle>.5 && uFlareStyle<1.5) {
    float rays=0.0;
    for(int i=0;i<3;i++) {
      float a=float(i)*1.04719755+.15;
      vec2 axis=vec2(cos(a),sin(a));
      float across=abs(dot(p,vec2(-axis.y,axis.x)));
      float along=abs(dot(p,axis));
      rays+=exp(-across/(size*.007+.0002))*exp(-along/(size*1.55));
    }
    glow+=vec3(.85,.9,1.0)*rays*.55;
    glow+=vec3(.35,.52,1.0)*exp(-abs(p.y)/(size*.016+.0002))*exp(-abs(p.x)/(size*4.5))*.18;
  }
  if(uFlareStyle>1.5) {
    vec2 axis=-light;
    glow+=ghost(uv-(light+axis*.72),size*.24,vec3(.4,.7,1.0),.7);
    glow+=ghost(uv-(light+axis*1.25),size*.48,vec3(.5,1.0,.55),.9);
    glow+=ghost(uv-(light+axis*1.70),size*.32,vec3(1.0,.35,.22),.9);
    glow+=ghost(uv-(light+axis*2.15),size*.75,vec3(.5,.4,1.0),.65);
    glow+=ghost(uv-(light+axis*2.55),size*.18,vec3(1.0,.72,.3),.8);
    glow+=vec3(.5,.7,1.0)*exp(-abs(p.y)/(size*.012+.0002))*exp(-abs(p.x)/(size*3.0))*.12;
  }
  vec3 rgb=1.0-(1.0-straight(c))*exp(-glow*uFlare.x*2.2);
  finalColor=photo(rgb,c.a);
}`,
};
