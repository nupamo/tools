import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPhoto, sample, boxBlur, type Plane } from '../src/lib/photo/effects';
import { INITIAL, NEUTRAL } from '../src/lib/photo/state';
const plane = (w: number, h: number, fn: (x: number,y: number)=>number): Plane => ({ width:w,height:h,data:Float32Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))) });
const image = (w: number,h: number, fn:(x:number,y:number)=>number[] = ()=>[200,150,120,255]) => Uint8ClampedArray.from(Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))).flat());
test('neutral edit preserves exact original pixels and alpha, without mutating source',()=>{
 const source=image(3,2,(x,y)=>[x*80,y*190,121,(x+y)*51]);const copy=source.slice();
 assert.deepEqual(renderPhoto(source,3,2,NEUTRAL).pixels,source);assert.deepEqual(source,copy);
});
test('one stop of exposure doubles midtones and preserves transparency',()=>{
 assert.deepEqual([...renderPhoto(new Uint8ClampedArray([40,50,60,125]),1,1,{...NEUTRAL,exposure:100}).pixels],[80,100,120,125]);
});
test('depth focus protects matching depths in separated image positions',()=>{
 const source=image(80,40,(x,y)=>[(x+y)%2*200,80,50,255]);
 const depth=plane(80,40,x=>x<20||x>=60?.8:.1);
 const out=renderPhoto(source,80,40,{...NEUTRAL,focusMode:'depth',depthFocus:.8,focusRange:10,blur:100},{depth}).pixels;
 for(const x of [10,70])assert.deepEqual(out.slice((20*80+x)*4,(20*80+x)*4+4),source.slice((20*80+x)*4,(20*80+x)*4+4));
 assert.notDeepEqual(out.slice((20*80+40)*4,(20*80+40)*4+4),source.slice((20*80+40)*4,(20*80+40)*4+4));
});
test('frames expand original dimensions rather than rescale the original content',()=>{
 for(const frame of ['solid','double','polaroid'] as const){
  const source=image(80,60),out=renderPhoto(source,80,60,{...NEUTRAL,frame,frameWidth:5});
  assert.equal(out.width,86);assert.equal(out.height,frame==='polaroid'?72:66);
  const at=((out.offsetY+30)*out.width+out.offsetX+40)*4;assert.deepEqual([...out.pixels.slice(at,at+4)],[200,150,120,255]);
 }
});
test('glow and each flare style alter colours, preserve alpha and never mutate original',()=>{
 const source=image(40,30,(x,y)=>[40+x,50+y,60,100]),copy=source.slice();
 for(const flareStyle of ['soft','star','ghost'] as const){const out=renderPhoto(source,40,30,{...NEUTRAL,glow:70,flare:80,flareStyle});assert.notDeepEqual(out.pixels,source);for(let p=3;p<source.length;p+=4)assert.equal(out.pixels[p],source[p]);}
 assert.deepEqual(source,copy);
});
test('bilinear mask sampling clamps boundaries and preserves middle values',()=>{
 const map=plane(2,2,(x,y)=>x===y?0:1);assert.equal(sample(map,.5,.5),.5);assert.equal(sample(map,-1,-1),0);assert.equal(sample(map,2,0),1);
});
test('blur handles one-pixel and thin images, and invalid image dimensions are rejected',()=>{
 for(const [w,h]of [[1,1],[1,7],[7,1]]){const source=image(w,h,()=>[90,90,90,90]);assert.deepEqual(boxBlur(source,w,h,12),source);assert.equal(renderPhoto(source,w,h,{...NEUTRAL,glow:100,focusMode:'manual',blur:100}).pixels.length,source.length);}
 assert.throws(()=>renderPhoto(new Uint8ClampedArray(4),2,2,NEUTRAL),/크기/);
});

test('bypassing an effect preserves its settings while rendering its neutral state',()=>{
 const source=image(8,8),edit={...NEUTRAL,exposure:60,lightEnabled:false};assert.deepEqual(renderPhoto(source,8,8,edit).pixels,source);assert.equal(edit.exposure,60);
 const framed=renderPhoto(source,8,8,{...NEUTRAL,frame:'solid',frameEnabled:false});assert.equal(framed.width,8);assert.equal(framed.height,8);
});

test('rounded corners preserve image size and content without adding padding',()=>{
 const source=image(80,60),copy=source.slice();
 const out=renderPhoto(source,80,60,{...NEUTRAL,frame:'round',frameWidth:12,frameColor:'#123456'});
 assert.equal(out.width,80);assert.equal(out.height,60);assert.equal(out.offsetX,0);assert.equal(out.offsetY,0);
 assert.equal(out.pixels[3],0);assert.equal(out.pixels[(80*60-1)*4+3],0);
 const center=(30*80+40)*4;assert.deepEqual(out.pixels.slice(center,center+4),source.slice(center,center+4));
 assert.deepEqual(source,copy);
});

test('new-photo defaults apply glow and ghost flare; disabling both truly bypasses them',()=>{
 assert.equal(INITIAL.glow,20);assert.equal(INITIAL.glowRadius,20);assert.equal(INITIAL.flareStyle,'ghost');assert.equal(INITIAL.flare,50);assert.equal(INITIAL.flareSize,50);
 const src=image(40,30);assert.notDeepEqual(renderPhoto(src,40,30,INITIAL).pixels,src);
 assert.deepEqual(renderPhoto(src,40,30,{...INITIAL,glowEnabled:false,flareEnabled:false}).pixels,src);
});
test('depth preview and export are plain grayscale at their own resolution, independent of effects and frames',()=>{
 const depth=plane(2,2,x=>x),edit={...INITIAL,exposure:100,frame:'solid' as const};
 const preview=renderPhoto(image(2,2),2,2,edit,{depth},'depth');
 const exported=renderPhoto(image(6,4),6,4,edit,{depth},'depth');
 assert.equal(preview.width,2);assert.equal(exported.width,6);assert.equal(exported.height,4);assert.equal(exported.offsetX,0);
 assert.deepEqual([...preview.pixels.slice(0,8)],[64,64,64,255,191,191,191,255]);
 for(let i=0;i<exported.pixels.length;i+=4){assert.equal(exported.pixels[i],exported.pixels[i+1]);assert.equal(exported.pixels[i],exported.pixels[i+2]);assert.equal(exported.pixels[i+3],255);}
 assert.deepEqual(exported.pixels,renderPhoto(image(6,4),6,4,NEUTRAL,{depth},'depth').pixels);
 assert.throws(()=>renderPhoto(image(2,2),2,2,edit,{},'depth'),/깊이 분석/);
});
