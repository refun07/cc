import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNidReadings, normalizeNidContrast, recognizeNid, flattenNidPaper } from './nidRecognition.js';

const complete='Name: TEST PERSON\nDate of Birth: 20/02/1990\nID NO.: 5837291640';
function workerFor(texts) {
  let calls=0;
  return { modes:[], languages:[], terminated:0, async terminate(){this.terminated++;}, get calls(){return calls;}, async reinitialize(lang){this.languages.push(lang);}, async setParameters(params){this.modes.push(params.tessedit_pageseg_mode);}, async recognize(){
    const entry=texts[calls++] || '', text=typeof entry==='string' ? entry : entry.text;
    return {data:{text,blocks:[{paragraphs:[{lines:text.split('\n').map((text,i)=>({text,confidence:entry.confidence ?? 95,bbox:{x0:80,y0:30+i*30,x1:350,y1:50+i*30}}))}]}]}};
  } };
}
const noCrop={isolate:async photo=>photo,cropName:async()=>{throw Error('no crop');}};
test('clear cards verify only the name crop without OpenCV, Bengali or full-image retries', async()=>{
  const worker=workerFor([complete,complete]);
  let isolated=0,enhanced=0;
  const result=await recognizeNid(worker, 'original', {cropName:async()=> 'name crop',isolate:async()=>{isolated++;},enhance:()=>{enhanced++;}});
  assert.equal(worker.calls,2);
  assert.deepEqual(worker.languages,[]);
  assert.deepEqual(worker.modes,['3','6']);
  assert.equal(isolated,0);
  assert.equal(enhanced,0);
  assert.equal(result.fields.name,'TEST PERSON');
  assert.equal(result.fields.date_of_birth,'1990-02-20');
});
test('budget exhaustion retains already read fields and does not start more passes', async()=>{
  const worker=workerFor(['Date of Birth: 20/02/1990\nID NO.: 5837291640']);
  let tick=0;
  const recognize=worker.recognize.bind(worker);
  worker.recognize=async()=>{const value=await recognize();tick=100;return value;};
  const result=await recognizeNid(worker,'original',{...noCrop,budgetMs:50,now:()=>tick});
  assert.equal(result.timedOut,true);
  assert.equal(worker.calls,1);
  assert.equal(result.fields.nid_number,'5837291640');
});
test('stalled OCR is terminated and returns a bounded review result', async()=>{
  const worker=workerFor([]);
  worker.recognize=()=>new Promise(()=>{});
  const result=await recognizeNid(worker,'original',{...noCrop,budgetMs:20});
  assert.equal(result.timedOut,true);
  assert.equal(worker.terminated,1);
  assert.equal(result.fields.name,'');
});
test('missing fields trigger contrast and sparse-layout retry', async()=>{
  const worker=workerFor(['Name: TEST PERSON','Date of Birth: 20/02/1990\nID NO.: 5837291640',complete]);
  let enhanced=0;
  const result=await recognizeNid(worker, 'original', {...noCrop,enhance:async()=>{enhanced++;return 'contrast';}});
  assert.equal(enhanced,1);
  assert.deepEqual(worker.modes,['3','11','6']);
  assert.deepEqual(result.fields,{name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'});
});
test('a name label recovered by the final block pass still gets verified', async()=>{
  const partial='Date of Birth: 20/02/1990\nID NO.: 5837291640';
  const worker=workerFor([partial,partial,complete,'Name: TEST PERSON']);
  const result=await recognizeNid(worker,'original',{isolate:async photo=>photo,enhance:async photo=>photo,cropName:async()=> 'name crop'});
  assert.equal(worker.calls,4);
  assert.equal(result.fields.name,'TEST PERSON');
});
test('rotated name crops use the image matching the recognized boxes', async()=>{
  const worker=workerFor([complete,complete]);
  const recognize=worker.recognize.bind(worker);
  const rotations=[];
  worker.recognize=async(source,options)=>{rotations.push(options.rotateAuto);const result=await recognize();result.data.rotateRadians=.1;result.data.imageGrey='aligned image';return result;};
  let croppedSource;
  const result=await recognizeNid(worker,'original',{cropName:async source=>{croppedSource=source;return 'name crop';}});
  assert.equal(croppedSource,'aligned image');
  assert.equal(result.fields.name,'TEST PERSON');
  assert.equal(worker.calls,2);
  assert.deepEqual(rotations,[true,false]);
});
test('conflicting identity numbers remain blank instead of guessing', ()=>{
  assert.equal(mergeNidReadings([{nid_number:'5837291640'},{nid_number:'5837291648'}]).nid_number,'');
});
test('bilingual and capitalization differences do not erase the labelled English name', ()=>{
  assert.equal(mergeNidReadings([{name:'পরীক্ষা ব্যক্তি'},{name:'Test  Person'},{name:'TEST PERSON'}]).name,'TEST PERSON');
  assert.equal(mergeNidReadings([{name:'TEST PERSON'},{name:'OTHER PERSON'}]).name,'');
});
test('failed enhancement preserves earlier extracted fields and retries original', async()=>{
  const worker=workerFor(['Name: TEST PERSON','ID NO.: 5837291640','Name: TEST PERSON']);
  const result=await recognizeNid(worker,'original',{...noCrop,enhance:async()=>{throw Error('decode');}});
  assert.equal(result.fields.name,'TEST PERSON');
  assert.equal(result.fields.nid_number,'5837291640');
  assert.equal(result.fields.date_of_birth,'');
});
test('a plausible partial first name never ends recognition early', async()=>{
  const worker=workerFor([complete.replace('TEST PERSON','LR PERSON'),complete,complete]);
  const result=await recognizeNid(worker,'original',{...noCrop,enhance:async photo=>photo});
  assert.equal(worker.calls,3);
  assert.equal(result.fields.name,'TEST PERSON');
});
test('unreadable names remain blank even if DOB and NID are available', async()=>{
  const worker=workerFor(Array.from({length:3},()=>({text:complete,confidence:35})));
  const result=await recognizeNid(worker,'original',{...noCrop,enhance:async photo=>photo});
  assert.equal(result.fields.name,'');
  assert.equal(result.fields.date_of_birth,'1990-02-20');
  assert.equal(result.fields.nid_number,'5837291640');
});
test('label-anchored enlarged name crop recovers a name without overwriting DOB/NID', async()=>{
  const weak={text:complete.replace('TEST PERSON','LR PERSON'),confidence:35};
  const worker=workerFor([weak,weak,weak,'Name: TEST PERSON','Name: TEST PERSON']);
  const passes=[];
  const result=await recognizeNid(worker,'original',{isolate:async photo=>photo,cropName:async()=> 'name crop',enhance:async photo=>photo,onPass:pass=>passes.push(pass)});
  assert.deepEqual(passes,[1,2,3,4,5]);
  assert.deepEqual(result.fields,{name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'});
});
test('independent names with equal support stay blank', async()=>{
  const worker=workerFor([complete,complete.replace('TEST PERSON','OTHER PERSON'),'']);
  const result=await recognizeNid(worker,'original',{...noCrop,enhance:async photo=>photo});
  assert.equal(result.fields.name,'');
});
test('cancelled work does not start OCR passes', async()=>{
  const worker=workerFor([complete]);
  await assert.rejects(recognizeNid(worker,'original',{isActive:()=>false}),/cancelled/);
  assert.equal(worker.calls,0);
});
test('contrast normalization expands faint grayscale and retains alpha', ()=>{
  const pixels=new Uint8ClampedArray([150,150,150,255,190,190,190,255]);
  assert.deepEqual([...normalizeNidContrast(pixels)],[0,0,0,255,255,255,255,255]);
  assert.deepEqual([...normalizeNidContrast(new Uint8ClampedArray([255,255,255,255]))],[255,255,255,255]);
});
test('local paper normalization preserves dark print and alpha while removing flat shading',()=>{
  const width=50,height=50,data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++)data.set([170,180,175,255],i*4);
  data.set([20,20,20,255],(25*width+25)*4);
  flattenNidPaper({data,width,height});
  assert.equal(data[0],255);assert.equal(data[(25*width+25)*4],0);assert.equal(data[3],255);
});
test('front/back regions are both scanned and conflicting cards stay unresolved',async()=>{
  const worker=workerFor([complete,complete.replace('5837291640','6847391520'),complete]);
  const result=await recognizeNid(worker,'original',{...noCrop,prepare:async()=>['front','back'],enhance:async photo=>photo});
  assert.equal(result.fields.nid_number,'');
  assert.ok(worker.calls>=2);
});
