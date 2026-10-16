import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL, commitEdit, editGroup, newHistory, undoEdit, redoEdit, restorePreset } from '../src/lib/photo/state';
test('multiple slider, toggle and position adjustments within one effect form one undo step',()=>{
 let h=newHistory();
 for(const patch of [{flare:30},{flare:60},{flareX:.3,flareY:.7},{flareEnabled:false},{flareEnabled:true},{flareStyle:'star' as const}]) h=commitEdit(h,{...h.present,...patch},undefined,editGroup(patch));
 assert.equal(h.past.length,1);assert.deepEqual(undoEdit(h).present,INITIAL);assert.deepEqual(redoEdit(undoEdit(h)).present,h.present);
});
test('switching effects closes the group; revisiting starts a new step',()=>{
 let h=newHistory();
 for(const patch of [{exposure:10},{contrast:15},{warmth:20},{exposure:30}]) h=commitEdit(h,{...h.present,...patch},undefined,editGroup(patch));
 assert.equal(h.past.length,3);
 h=undoEdit(h);assert.equal(h.present.exposure,10);assert.equal(h.present.contrast,15);assert.equal(h.present.warmth,20);
 h=undoEdit(h);assert.equal(h.present.warmth,0);assert.equal(h.present.exposure,10);
 h=undoEdit(h);assert.deepEqual(h.present,INITIAL);
});
test('a net-zero effect leaves no undo step, and tab boundaries can end a group without editing',()=>{
 let h=commitEdit(newHistory(),{...INITIAL,exposure:20},undefined,'light');
 h=commitEdit(h,{...INITIAL},undefined,'light');assert.equal(h.past.length,0);
 h=commitEdit(h,{...INITIAL,exposure:10},undefined,'light');
 h={...h,group:undefined};h=commitEdit(h,{...h.present,contrast:15},undefined,'light');assert.equal(h.past.length,2);
});
test('compound presets and editing after undo are separate from earlier groups',()=>{
 assert.equal(editGroup({exposure:10,warmth:20}),undefined);
 let h=commitEdit(newHistory(),{...INITIAL,exposure:10},undefined,'light');
 h=commitEdit(h,{...h.present,exposure:30,warmth:20});assert.equal(h.past.length,2);
 h=undoEdit(h);h=commitEdit(h,{...h.present,contrast:25},undefined,'light');assert.equal(h.future.length,0);assert.equal(h.past.length,2);assert.equal(undoEdit(h).present.exposure,10);
});
test('a branch after undo discards redo and no-op edits do not pollute history',()=>{
 let h=commitEdit(newHistory(),{...INITIAL,exposure:5});h=commitEdit(h,{...h.present,contrast:10});h=undoEdit(h);h=commitEdit(h,{...h.present,warmth:20});assert.equal(h.future.length,0);assert.equal(commitEdit(h,{...h.present}).past.length,h.past.length);
});
test('history is bounded and preset input is validated',()=>{
 let h=newHistory();for(let i=1;i<=70;i++)h=commitEdit(h,{...h.present,exposure:i});assert.equal(h.past.length,50);
 assert.deepEqual(restorePreset(INITIAL),INITIAL);assert.equal(restorePreset({...INITIAL,flareX:NaN}),null);assert.equal(restorePreset({...INITIAL,frame:'<script>'}),null);assert.equal(restorePreset({...INITIAL,frameColor:'bad'}),null);assert.equal(restorePreset({exposure:20}),null);
});

test('preset values are clamped to safe UI ranges',()=>{
 const restored=restorePreset({...INITIAL,frameWidth:900,outlineWidth:100,glow:-80,focusX:20})!;
 assert.equal(restored.frameWidth,12);assert.equal(restored.outlineWidth,6);assert.equal(restored.glow,0);assert.equal(restored.focusX,1);
});
