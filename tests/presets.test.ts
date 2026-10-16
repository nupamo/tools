import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addPreset, readPresets, replacePreset, writePresets, PRESET_KEY } from '../src/lib/photo/presets';
import { INITIAL } from '../src/lib/photo/state';
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
test('multiple named presets survive reload; replacing or deleting one preserves the others',()=>{
 const disk=storage();let list=addPreset([],'풍경',{...INITIAL,exposure:20});list=addPreset(list,'인테리어',{...INITIAL,exposure:40});
 assert.notEqual(list[0].id,list[1].id);writePresets(disk,list);assert.deepEqual(readPresets(disk),list);
 list=replacePreset(list,list[0].id,{...INITIAL,exposure:60});assert.equal(list[0].settings.exposure,60);assert.equal(list[1].settings.exposure,40);
 writePresets(disk,list.slice(1));assert.deepEqual(readPresets(disk),list.slice(1));
 assert.throws(()=>addPreset(list,'  풍경  ',INITIAL),/같은 이름/);assert.throws(()=>addPreset(list,'  ',INITIAL),/이름/);
});
test('legacy single preset migrates once and removed person settings are ignored',()=>{
 const disk=storage();disk.setItem('tools-photo-preset-v1',JSON.stringify({...INITIAL,focusMode:'person',background:'transparent',exposure:35}));
 const result=readPresets(disk);assert.equal(result.length,1);assert.equal(result[0].settings.exposure,35);assert.equal(result[0].settings.focusMode,'off');assert.equal('background' in result[0].settings,false);
 writePresets(disk,[]);assert.deepEqual(readPresets(disk),[]); // No resurrection after deleting the migrated entry.
});
test('failed migration write retains old settings, and failed saves do not change persisted presets',()=>{
 const disk=storage();disk.setItem('tools-photo-preset-v1',JSON.stringify(INITIAL));
 const denied={getItem:disk.getItem,setItem:()=>{throw new Error('quota');}};
 assert.equal(readPresets(denied).length,1);assert.equal(disk.getItem(PRESET_KEY),null);
 const original=addPreset([],'원본 설정',INITIAL);writePresets(disk,original);
 assert.throws(()=>writePresets(denied,addPreset(original,'추가',INITIAL)),/quota/);assert.deepEqual(readPresets(disk),original);
});
test('invalid records cannot inject unsupported effect settings or duplicate IDs',()=>{
 const disk=storage();disk.setItem(PRESET_KEY,JSON.stringify([{id:'a',name:'정상',settings:INITIAL},{id:'a',name:'중복',settings:INITIAL},{id:'b',name:'손상',settings:{exposure:3}}]));assert.equal(readPresets(disk).length,1);
});
