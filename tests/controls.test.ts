import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import PhotoControls from '../src/components/PhotoControls';
import { INITIAL, newHistory } from '../src/lib/photo/state';
import type { PhotoEditorModel } from '../src/lib/photo/usePhotoEditor';

test('presets are inline, advanced exposes depth selection, and map mode changes the download action',async()=>{
 const win=new Window({url:'https://tools.nupa.moe/photo/'}),previous=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:win,document:win.document,navigator:win.navigator,HTMLElement:win.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const container=win.document.createElement('div');win.document.body.append(container);const root=createRoot(container as unknown as HTMLElement);
 const applied:unknown[]=[],saved:string[]=[],panels:string[]=[];
 const noop=()=>{};
 const e={panel:'presets',tab:'focus',edit:{...INITIAL,focusMode:'depth',depthFocus:.73},photo:{name:'photo.png',width:800,height:600},history:newHistory(),locked:false,hasDepth:true,depthSupported:true,depth:{status:'ready',text:'깊이 분석 완료'},maskView:'none',compare:'current',format:'png',engineReady:true,error:'',message:'',savedPresets:[{id:'one',name:'풍경',settings:INITIAL},{id:'two',name:'야경',settings:{...INITIAL,exposure:35}}],setPanel:(p:string)=>panels.push(p),setTab:noop,setMaskView:noop,update:noop,resetGroup:noop,setCompare:noop,setFormat:noop,save:noop,applyPreset:(s:unknown)=>applied.push(s),storePreset:(name:string)=>{saved.push(name);return 'new';},overwritePreset:noop,deletePreset:noop} as unknown as PhotoEditorModel;
 const render=()=>act(async()=>root.render(createElement(PhotoControls,{editor:e})));
 try{
  await render();assert(container.querySelector('#preset-defaults'));assert.equal(container.querySelector('[role=dialog]'),null);assert.equal(container.querySelectorAll('.saved-preset-select option').length,2);
  const button=(label:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===label)!;
  await act(async()=>button('자연스럽게').click());assert.equal(applied.length,1);
  const select=container.querySelector('.saved-preset-select') as unknown as HTMLSelectElement;await act(async()=>{select.value='two';select.dispatchEvent(new win.Event('change',{bubbles:true}) as unknown as Event);});await act(async()=>button('적용').click());assert.equal((applied.at(-1) as typeof INITIAL).exposure,35);
  await act(async()=>container.querySelector('#panel-tab-advanced')!.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));assert.deepEqual(panels,['advanced']);
  e.panel='advanced';await render();assert.equal(container.querySelector('#panel-presets')!.hasAttribute('hidden'),true);assert(!container.textContent?.includes('인물'));
  const depthSlider=[...container.querySelectorAll('[role=slider]')].find(slider=>win.document.getElementById(slider.getAttribute('aria-labelledby')!)?.textContent==='초점 깊이');assert(depthSlider);assert.equal(depthSlider.getAttribute('aria-valuenow'),'73');
  e.maskView='depth';await render();assert(button('깊이 지도 저장'));assert.equal((container.querySelector('.format-row select') as unknown as HTMLSelectElement).disabled,true);
 }finally{await act(async()=>root.unmount());for(const [key,d]of previous){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key);}await win.happyDOM.close();}
});
