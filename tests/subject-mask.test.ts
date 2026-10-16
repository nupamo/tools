import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refinePersonMask } from '../src/lib/photo/subject-mask';
import { renderPhoto, type Plane } from '../src/lib/photo/effects';
import { INITIAL } from '../src/lib/photo/state';
const plane=(w:number,h:number,fn:(x:number,y:number)=>number):Plane=>({width:w,height:h,data:Float32Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w)))});
test('depth sharpens ambiguous semantic boundaries and preserves confident labels',()=>{
 const person=plane(32,12,x=>x<12?.01:x>=20?.99:.5),copy=person.data.slice();
 const depth=plane(64,24,x=>x<32?.1:.9);
 const result=refinePersonMask(person,depth);assert.equal(result.refined,true);const p=result.person!;
 assert.equal(p.width,64);assert.equal(p.height,24);
 assert.ok(p.data[12*64+30]<.2);assert.ok(p.data[12*64+33]>.8);
 assert.ok(p.data[12*64+5]<.02);assert.ok(p.data[12*64+58]>.98);assert.deepEqual(person.data,copy);
 const src=new Uint8ClampedArray(64*24*4).fill(255),edit={...INITIAL,background:'transparent' as const};
 const raw=renderPhoto(src,64,24,edit,{person}).pixels,refined=renderPhoto(src,64,24,edit,{person:p}).pixels;
 assert.ok(refined[(12*64+30)*4+3]<raw[(12*64+30)*4+3]);assert.ok(refined[(12*64+33)*4+3]>raw[(12*64+33)*4+3]);
});
test('missing, flat or invalid depth retains the semantic mask',()=>{
 const person=plane(32,12,x=>x<12?.01:x>=20?.99:.5);
 for(const depth of [undefined,plane(64,24,()=>.5),plane(64,24,()=>NaN)]){const result=refinePersonMask(person,depth);assert.equal(result.refined,false);assert.equal(result.person,person);}
 assert.equal(refinePersonMask(undefined,plane(64,24,x=>x/64)).person,undefined);
});
test('depth cannot create a person where semantic labels have no local foreground',()=>{
 const person=plane(32,12,()=>.1),depth=plane(64,24,x=>x<32?.1:.9);
 const result=refinePersonMask(person,depth);assert.equal(result.refined,false);assert.equal(result.person,person);
});
test('background at the same depth as the foreground does not override semantic evidence',()=>{
 const person=plane(32,64,x=>x<12?.01:x>=20?.99:.5);
 const result=refinePersonMask(person,plane(64,128,(x,y)=>y===0?x/64:.5));
 // At the ambiguous central boundary both labels share the same depth.
 assert.equal(result.person!.width === 64 ? result.person!.data[64*64+31] : result.person!.data[32*32+15],.5);
});
