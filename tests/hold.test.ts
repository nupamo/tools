import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HoldButton from '../src/components/HoldButton';

test('hold comparison returns on outside release, cancel, focus loss and keyboard release; clicks never toggle',async()=>{
 const win=new Window({url:'https://tools.nupa.moe/photo/'});
 const previous=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:win,document:win.document,navigator:win.navigator,HTMLElement:win.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 win.HTMLElement.prototype.setPointerCapture=()=>{};
 const container=win.document.createElement('div');win.document.body.append(container);const root=createRoot(container as unknown as HTMLElement);
 function Harness(){const [held,setHeld]=useState(false);return createElement(HoldButton,{label:'원본 보기',active:held,onHold:()=>setHeld(true),onRelease:()=>setHeld(false)});}
 try{
  await act(async()=>root.render(createElement(Harness)));const button=container.querySelector('button')!;
  const state=()=>button.getAttribute('aria-pressed');
  const pointer=async(type:string,target: typeof win.document.body | typeof button =button,pointerType='mouse')=>act(async()=>target.dispatchEvent(new win.PointerEvent(type,{bubbles:true,button:0,pointerId:7,pointerType})));
  await act(async()=>button.click());assert.equal(state(),'false');
  await pointer('pointerdown');assert.equal(state(),'true');await pointer('pointerup',win.document.body);assert.equal(state(),'false');
  await pointer('pointerdown',button,'touch');assert.equal(state(),'true');await pointer('pointercancel');assert.equal(state(),'false');
  await pointer('pointerdown');await act(async()=>win.dispatchEvent(new win.Event('blur')));assert.equal(state(),'false');
  await pointer('pointerdown');await act(async()=>button.dispatchEvent(new win.Event('lostpointercapture',{bubbles:true})));assert.equal(state(),'false');
  for(const key of [' ','Enter']){await act(async()=>button.dispatchEvent(new win.KeyboardEvent('keydown',{key,bubbles:true})));assert.equal(state(),'true');await act(async()=>button.dispatchEvent(new win.KeyboardEvent('keyup',{key,bubbles:true})));assert.equal(state(),'false');}
 }finally{await act(async()=>root.unmount());for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}await win.happyDOM.close();}
});
