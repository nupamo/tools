import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL, commitEdit, newHistory, undoEdit, redoEdit, restorePreset } from '../src/lib/photo/state';
test('one continuous drag creates one undo step, preserving its previous settings',()=>{
 const h=newHistory(),base={...h.present};const mid={...h,present:{...h.present,exposure:10}};
 const end=commitEdit(mid,{...mid.present,exposure:35},base);assert.equal(end.past.length,1);assert.equal(end.past[0].exposure,0);assert.equal(undoEdit(end).present.exposure,0);assert.equal(redoEdit(undoEdit(end)).present.exposure,35);
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
