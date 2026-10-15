import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPhoto, sample, boxBlur, type Plane } from '../src/lib/photo/effects';
import { INITIAL } from '../src/lib/photo/state';
const plane = (w: number, h: number, fn: (x: number,y: number)=>number): Plane => ({ width:w,height:h,data:Float32Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))) });
const image = (w: number,h: number, fn:(x:number,y:number)=>number[] = ()=>[200,150,120,255]) => Uint8ClampedArray.from(Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))).flat());
test('neutral edit preserves exact original pixels and alpha, without mutating source',()=>{
 const source=image(3,2,(x,y)=>[x*80,y*190,121,(x+y)*51]);const copy=source.slice();
 assert.deepEqual(renderPhoto(source,3,2,INITIAL).pixels,source);assert.deepEqual(source,copy);
});
test('one stop of exposure doubles midtones and preserves transparency',()=>{
 assert.deepEqual([...renderPhoto(new Uint8ClampedArray([40,50,60,125]),1,1,{...INITIAL,exposure:100}).pixels],[80,100,120,125]);
});
test('skin adjustment uses the model mask, not the colour of the pixels',()=>{
 const source=image(4,1),skin=plane(4,1,(x)=>x<2?1:0);
 const adjusted=renderPhoto(source,4,1,{...INITIAL,skinTone:30},{skin}).pixels;
 assert.ok(adjusted[0]>source[0]); assert.deepEqual(adjusted.slice(12),source.slice(12));
 assert.deepEqual(renderPhoto(source,4,1,{...INITIAL,skinTone:30}).pixels,source);
});
test('transparent background follows confidence, and never makes a transparent original opaque',()=>{
 const source=image(8,2,(x)=>[200,150,120,x===4?0:255]),person=plane(8,2,x=>x<3?0:1);
 const out=renderPhoto(source,8,2,{...INITIAL,background:'transparent'},{person});
 assert.equal(out.pixels[3],0);assert.equal(out.pixels[7*4+3],255);assert.equal(out.pixels[4*4+3],0);
});
test('outside subject outline extends alpha, while keeping opaque subject colours',()=>{
 const source=image(100,60),person=plane(100,60,(x,y)=>x>=30&&x<70&&y>=15&&y<45?1:0);
 const out=renderPhoto(source,100,60,{...INITIAL,background:'transparent',outlineWidth:6},{person}).pixels;
 const center=(30*100+50)*4,stroke=(30*100+28)*4,far=(30*100+5)*4;
 assert.deepEqual([...out.slice(center,center+4)],[200,150,120,255]);assert.ok(out[stroke+3]>200);assert.ok(out[stroke]>245);assert.equal(out[far+3],0);
});
test('focus blur preserves the person and does not smear their red colour into blue background',()=>{
 const source=image(80,50,(x,y)=>x>=30&&x<50?[255,0,0,255]:[0,0,100+((x+y)%2)*100,255]);
 const person=plane(80,50,x=>x>=30&&x<50?1:0);
 const out=renderPhoto(source,80,50,{...INITIAL,focusMode:'person',blur:100},{person}).pixels;
 const center=(25*80+40)*4,edge=(25*80+27)*4;
 assert.deepEqual([...out.slice(center,center+4)],[255,0,0,255]);assert.ok(out[edge]<4);assert.ok(out[edge+2]>100&&out[edge+2]<200);
});
test('depth focus protects matching depths in separated image positions',()=>{
 const source=image(80,40,(x,y)=>[(x+y)%2*200,80,50,255]);
 const depth=plane(80,40,x=>x<20||x>=60?.8:.1);
 const out=renderPhoto(source,80,40,{...INITIAL,focusMode:'depth',depthFocus:.8,focusRange:10,blur:100},{depth}).pixels;
 for(const x of [10,70])assert.deepEqual(out.slice((20*80+x)*4,(20*80+x)*4+4),source.slice((20*80+x)*4,(20*80+x)*4+4));
 assert.notDeepEqual(out.slice((20*80+40)*4,(20*80+40)*4+4),source.slice((20*80+40)*4,(20*80+40)*4+4));
});
test('frames expand original dimensions rather than rescale the original content',()=>{
 for(const frame of ['solid','double','polaroid','round'] as const){
  const source=image(80,60),out=renderPhoto(source,80,60,{...INITIAL,frame,frameWidth:5});
  assert.equal(out.width,86);assert.equal(out.height,frame==='polaroid'?72:66);
  const at=((out.offsetY+30)*out.width+out.offsetX+40)*4;assert.deepEqual([...out.pixels.slice(at,at+4)],[200,150,120,255]);
  if(frame==='round')assert.equal(out.pixels[3],0);
 }
});
test('glow and each flare style alter colours, preserve alpha and never mutate original',()=>{
 const source=image(40,30,(x,y)=>[40+x,50+y,60,100]),copy=source.slice();
 for(const flareStyle of ['soft','star','ghost'] as const){const out=renderPhoto(source,40,30,{...INITIAL,glow:70,flare:80,flareStyle});assert.notDeepEqual(out.pixels,source);for(let p=3;p<source.length;p+=4)assert.equal(out.pixels[p],source[p]);}
 assert.deepEqual(source,copy);
});
test('model display overlays are isolated from the saved render',()=>{
 const source=image(4,4),skin=plane(4,4,()=>1);
 assert.notDeepEqual(renderPhoto(source,4,4,INITIAL,{skin},'skin').pixels,renderPhoto(source,4,4,INITIAL,{skin}).pixels);
 assert.deepEqual(renderPhoto(source,4,4,INITIAL,{skin}).pixels,source);
});
test('bilinear mask sampling clamps boundaries and preserves middle values',()=>{
 const map=plane(2,2,(x,y)=>x===y?0:1);assert.equal(sample(map,.5,.5),.5);assert.equal(sample(map,-1,-1),0);assert.equal(sample(map,2,0),1);
});
test('blur handles one-pixel and thin images, and invalid image dimensions are rejected',()=>{
 for(const [w,h]of [[1,1],[1,7],[7,1]]){const source=image(w,h,()=>[90,90,90,90]);assert.deepEqual(boxBlur(source,w,h,12),source);assert.equal(renderPhoto(source,w,h,{...INITIAL,glow:100,focusMode:'manual',blur:100}).pixels.length,source.length);}
 assert.throws(()=>renderPhoto(new Uint8ClampedArray(4),2,2,INITIAL),/크기/);
});

test('bypassing an effect preserves its settings while rendering its neutral state',()=>{
 const source=image(8,8),edit={...INITIAL,exposure:60,lightEnabled:false};assert.deepEqual(renderPhoto(source,8,8,edit).pixels,source);assert.equal(edit.exposure,60);
 const framed=renderPhoto(source,8,8,{...INITIAL,frame:'solid',frameEnabled:false});assert.equal(framed.width,8);assert.equal(framed.height,8);
});
