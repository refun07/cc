import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNidName, findNidNameRegion, parseNidNameCrop, nidNameEvidence } from './nidName.js';

const page=lines=>({blocks:[{paragraphs:[{lines}]}]});
const line=(text,y0,y1,x1=240)=>({text,bbox:{x0:100,x1,y0,y1},confidence:90});
test('name region includes separate value and stops before parent',()=>{
  const region=findNidNameRegion(page([line('Name:',20,30),line('TEST PERSON',36,52,320),line('Father: OTHER PERSON',62,80)]));
  assert.ok(region.x0<100 && region.x1>320);
  assert.ok(region.y0<20 && region.y1>52 && region.y1<62);
});
test('parent labels, ambiguous names and rotated coordinates do not produce a crop',()=>{
  assert.equal(findNidNameRegion(page([line('Father Name: TEST PERSON',20,40)])),null);
  assert.equal(findNidNameRegion(page([line('Name: TEST PERSON',20,40),line('Name: OTHER PERSON',60,80)])),null);
  assert.equal(findNidNameRegion({...page([line('Name: TEST PERSON',20,40)]),rotateRadians:.1}),null);
});
test('name agreement requires confidence and does not combine fragments',()=>{
  assert.equal(chooseNidName([{name:'TEST PERSON',nameConfidence:95}]),'');
  assert.equal(chooseNidName([{name:'TEST PERSON',nameConfidence:90},{name:'test person',nameConfidence:85}]),'TEST PERSON');
  assert.equal(chooseNidName([{name:'TEST',nameConfidence:95},{name:'PERSON',nameConfidence:95}]),'');
  assert.equal(chooseNidName([{name:'TEST PERSON',nameConfidence:40},{name:'TEST PERSON',nameConfidence:40}]),'');
});
test('rotated boxes use the matching OCR image instead of the original photo',()=>{
  const data={...page([line('Name: TEST PERSON',20,40)]),rotateRadians:.1,imageGrey:'data:image/png;base64,synthetic'};
  assert.ok(findNidNameRegion(data));
});
test('short leading fragments are not auto-filled even when repeated',()=>{
  assert.equal(chooseNidName([{name:'LR PERSON',nameConfidence:95},{name:'LR PERSON',nameConfidence:95}]),'');
  assert.equal(chooseNidName([{name:'MD. TEST PERSON',nameConfidence:95},{name:'MD. TEST PERSON',nameConfidence:95}]),'MD. TEST PERSON');
});
test('one weak English reading cannot suppress a consistent Bengali name',()=>{
  assert.equal(chooseNidName([{name:'WRONG PERSON',nameConfidence:65},{name:'পরীক্ষা ব্যক্তি',nameConfidence:95},{name:'পরীক্ষা ব্যক্তি',nameConfidence:95}]),'পরীক্ষা ব্যক্তি');
});
test('word geometry ignores portrait noise overlapping the Name line',()=>{
  const word=(text,x0,y0,x1,y1)=>({text,confidence:90,bbox:{x0,y0,x1,y1}});
  const label=word('Name',100,50,150,65),first=word('TEST',100,80,180,100),last=word('PERSON',190,80,280,100);
  const data=page([{text:'Name',bbox:label.bbox,words:[label]},{text:'3 ~ TEST PERSON |',bbox:{x0:0,y0:45,x1:500,y1:120},words:[word('3',0,45,15,120),first,last,word('|',490,70,500,120)]}]);
  const region=findNidNameRegion(data);
  assert.ok(region.x0>80 && region.x1<310 && region.y1<120);
});
test('a label-anchored crop can read one bare name, never other fields or multiple lines',()=>{
  assert.equal(parseNidNameCrop('MD. TEST PERSON\n'),'MD. TEST PERSON');
  for(const value of ['Father: TEST PERSON','Name','TEST PERSON\nOTHER PERSON','1234567890'])assert.equal(parseNidNameCrop(value),'');
  assert.equal(chooseNidName([{name:'MD. TEST PERSON',nameConfidence:90},{name:'MD TEST PERSON',nameConfidence:85}]),'MD. TEST PERSON');
});
test('noise confidence is excluded but low-confidence substantive name words are retained as a warning',()=>{
  const data=page([{text:'MD TEST PERSON _',confidence:20,words:[{text:'MD',confidence:45},{text:'TEST',confidence:90},{text:'PERSON',confidence:86},{text:'_',confidence:5}]}]);
  assert.equal(nidNameEvidence(data,'MD TEST PERSON'),86);
  data.blocks[0].paragraphs[0].lines[0].words[2].confidence=30;
  assert.equal(nidNameEvidence(data,'MD TEST PERSON'),0);
});
