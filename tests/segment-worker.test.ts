import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/segment-worker.js',import.meta.url),'utf8');
async function simulate(failAt:'init'|'inference'){
 const delegates:string[]=[],messages:any[]=[];let closed=0,imageClosed=0,modelFetch=0;
 const values=[[1,0],[0,0],[0,.4],[0,.5],[0,0],[0,0]];
 const result=()=>({confidenceMasks:values.map(v=>({width:2,height:1,getAsFloat32Array:()=>new Float32Array(v)})),close:()=>closed++});
 const Vision={FilesetResolver:{forVisionTasks:async()=>({})},ImageSegmenter:{createFromOptions:async(_:unknown,options:any)=>{
  const delegate=options.baseOptions.delegate;delegates.push(delegate);if(delegate==='GPU'&&failAt==='init')throw new Error('GPU unavailable');
  return {segment:()=>{if(delegate==='GPU'&&failAt==='inference')throw new Error('GPU lost');return result();},close:()=>{}};
 }}};
 const sandbox:any={Vision,Float32Array,Uint8Array,Response,URL,OffscreenCanvas:class{},fetch:async()=>{modelFetch++;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Length':'3'}});},caches:{open:async()=>({match:async()=>null,put:async()=>{}})}};
 sandbox.self={Vision,location:{href:'https://tools.nupa.moe/segment-worker.js'},postMessage:(v:any)=>messages.push(v)};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 for(const id of [8,9]){sandbox.self.onmessage({data:{id,image:{close:()=>imageClosed++}}});await vm.runInContext('queue',sandbox);}
 return {delegates,messages,closed,imageClosed,modelFetch};
}
for(const failAt of ['init','inference'] as const)test(`MediaPipe worker retries ${failAt} GPU failure on CPU, copies masks, reuses model and frees results`,async()=>{
 const r=await simulate(failAt);assert.deepEqual(r.delegates,['GPU','CPU']);const results=r.messages.filter(x=>x.kind==='result');assert.equal(results.length,2);assert.equal(results[0].backend,'CPU');assert.deepEqual([...results[0].person.data],[0,1]);assert.ok(Math.abs(results[0].skin.data[1]-.9)<1e-6);assert.equal(r.closed,2);assert.equal(r.imageClosed,2);assert.equal(results[1].id,9);
});
