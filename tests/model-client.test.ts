import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModelClient } from '../src/lib/photo/model-client';
class FakeWorker {
 onmessage: ((event:any)=>void)|null=null;onerror:(()=>void)|null=null;messages:any[]=[];terminated=false;
 postMessage(value:any){this.messages.push(value);}terminate(){this.terminated=true;}
 reply(data:any){this.onmessage?.({data});}
}
test('model progress cannot enable features; only the matching completed request resolves',async()=>{
 const worker=new FakeWorker(),client=new ModelClient(()=>worker as unknown as Worker),progress:string[]=[];let resolved=false;
 const pending=client.run({image:'sample'},[],value=>progress.push(value.text)).then(value=>{resolved=true;return value;});const id=worker.messages[0].id;
 worker.reply({kind:'progress',id,text:'download',progress:.4});worker.reply({kind:'result',id:id+1,backend:'CPU'});await Promise.resolve();assert.equal(resolved,false);assert.deepEqual(progress,['download']);
 worker.reply({kind:'result',id,backend:'CPU'});assert.equal((await pending).backend,'CPU');assert.equal(client.busy,false);client.dispose();
});
test('cancelling a previous photo rejects pending work and retry creates a fresh worker',async()=>{
 const workers:FakeWorker[]=[];const client=new ModelClient(()=>{const worker=new FakeWorker();workers.push(worker);return worker as unknown as Worker;});
 const pending=client.run({},[],()=>{});const rejected=assert.rejects(pending,/modelCancelled/);client.dispose();await rejected;assert.equal(workers[0].terminated,true);
 const retry=client.run({},[],()=>{});workers[1].reply({kind:'result',id:workers[1].messages[0].id,backend:'GPU'});assert.equal((await retry).backend,'GPU');client.dispose();
});
