import assert from 'node:assert/strict';
// Optional native WebGL2 validation; not bundled into the browser application.
// Point PHOTO_WEBGL_MODULE at an installed webgl-node module.
const runtime=process.env.PHOTO_WEBGL_MODULE;
if(!runtime) throw new Error('Set PHOTO_WEBGL_MODULE to an installed webgl-node module path.');
const {createWebGL2Context}=await import(runtime);
const native=createWebGL2Context(1,1);
class Offscreen { constructor(){return native.canvas;} }
Object.assign(globalThis,{OffscreenCanvas:Offscreen,WebGLRenderingContext:class {},OffscreenCanvasRenderingContext2D:class {},location:{href:'https://tools.nupa.moe/photo/'}});
const {PixiPhotoRenderer}=await import('../src/lib/photo/pixi-renderer.ts');
const {NEUTRAL:INITIAL}=await import('../src/lib/photo/state.ts');
const engine=await PixiPhotoRenderer.create();
const image=(w,h,fn)=>Uint8ClampedArray.from(Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))).flat());
const plane=(w,h,fn)=>({width:w,height:h,data:Float32Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w)))});
function diff(a,b){let max=0,sum=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum+=d;}return {max,mean:sum/a.length};}
try {
 let src=image(3,2,(x,y)=>[x*80,y*190,121,(x+y)*51]);assert.deepEqual(engine.render(src,3,2,INITIAL).pixels,src);console.log('neutral exact');
 const one=engine.render(new Uint8ClampedArray([40,50,60,255]),1,1,{...INITIAL,exposure:100}).pixels;
 console.log('exposure', [...one]);assert.deepEqual([...one],[80,100,120,255]);
 src=image(120,80,(x,y)=>x>=45&&x<75?[255,0,0,255]:[0,0,100+((x+y)%2)*100,255]);
 const depth=plane(120,80,x=>x<30||x>=90?.8:.1);
 const depthOut=engine.render(src,120,80,{...INITIAL,focusMode:'depth',depthFocus:.8,focusRange:10,blur:100},{depth}).pixels;
 for(const x of [10,110]) assert.deepEqual(depthOut.slice((40*120+x)*4,(40*120+x)*4+4),src.slice((40*120+x)*4,(40*120+x)*4+4));
 assert(depthOut[(40*120+36)*4+2]>100&&depthOut[(40*120+36)*4+2]<200);console.log('depth focus protected');
 src=image(520,380,(x,y)=>[30+x%160,40+y%150,50+(x+y)%120,255]);
 const masks={depth:plane(130,95,x=>x/130)};
 const settings={...INITIAL,exposure:13,contrast:8,highlights:-20,shadows:25,warmth:15,vibrance:20,glow:60,focusMode:'depth',blur:80,depthFocus:.5,flare:85,flareStyle:'ghost'};
 const full=engine.render(src,520,380,settings,masks,'none',1536);
 const tiled=engine.render(src,520,380,settings,masks,'none',120);
 console.log('tile diff',diff(full.pixels,tiled.pixels));assert(diff(full.pixels,tiled.pixels).max<=4);
 for(const flareStyle of ['soft','star','ghost']) {const out=engine.render(src,520,380,{...INITIAL,flare:90,flareStyle,flareX:.78,flareY:.25});assert(out.pixels.some((n,i)=>n!==src[i]));}
 for(const mode of ['depth']) {const out=engine.render(src,520,380,INITIAL,masks,mode);assert(out.pixels.some((n,i)=>n!==src[i]));}
 const alphaSrc=image(30,25,(x,y)=>[80,120,150,(x+y)%3===0?0:100]);
 for(const settings of [{glow:70},{flare:90,flareStyle:'star'},{focusMode:'manual',blur:80}]){const out=engine.render(alphaSrc,30,25,{...INITIAL,...settings});for(let i=3;i<alphaSrc.length;i+=4)assert.equal(out.pixels[i],alphaSrc[i]);}
 const round=engine.render(src,520,380,{...INITIAL,frame:'round',frameWidth:12});
 assert.equal(round.width,520);assert.equal(round.height,380);assert.equal(round.offsetX,0);assert.equal(round.offsetY,0);assert.equal(round.pixels[3],0);
 assert.deepEqual(round.pixels.slice((190*520+260)*4,(190*520+260)*4+4),src.slice((190*520+260)*4,(190*520+260)*4+4));
 const {renderDepthMap}=await import('../src/lib/photo/effects.ts');
 const map=engine.render(src,520,380,{...settings,frame:'solid'},masks,'depth');
 assert.equal(map.width,520);assert.equal(map.height,380);assert.deepEqual(map.pixels,renderDepthMap(520,380,masks.depth).pixels);
 console.log('alpha + depth map + flare styles + unpadded round passed');
 const large=new Uint8ClampedArray(6000*4000*4);for(let p=0;p<large.length;p+=4){large[p]=80;large[p+1]=100;large[p+2]=120;large[p+3]=255;}
 const start=performance.now();const largeOut=engine.render(large,6000,4000,{...INITIAL,exposure:10});
 assert.equal(largeOut.width,6000);assert.equal(largeOut.height,4000);
 for(let p=0;p<largeOut.pixels.length;p+=40000){assert.equal(largeOut.pixels[p+3],255);for(let c=0;c<3;c++)assert(Math.abs(largeOut.pixels[p+c]-[86,107,129][c])<=1);}
 console.log('24 MP tiled original export',Math.round(performance.now()-start),'ms');
 const glError=native.gl.getError();console.log('GL error',glError);assert.equal(glError,0);
} finally {engine.destroy();native.destroy();}
