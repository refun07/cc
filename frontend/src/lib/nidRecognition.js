import { parseNidText } from './nidOcr.js';
import { chooseNidName, findNidNameLine, findNidNameRegion, findNidTextColumn, nidNameEvidence, parseNidNameCrop } from './nidName.js';
import { cropNidName, isolateNidCard, prepareNidOcrImage } from './nidOcrImage.js';
import { reconcileNidMrz } from './nidMrz.js';

export const NID_OCR_PASSES = 5;
// Budget phones run Tesseract several times slower than a desktop. A shorter
// budget stopped them before the passes that read real cards had finished.
export const NID_OCR_BUDGET_MS = 45000;

export function mergeNidReadings(readings) {
  const result = { name:'', date_of_birth:'', nid_number:'' };
  for (const key of Object.keys(result)) {
    let candidates=readings.map(reading => reading[key]).filter(Boolean);
    if (key==='name') {
      const latin=candidates.filter(value=>/[a-z]/i.test(value) && !/[\u0980-\u09ff]/.test(value));
      candidates=(latin.length ? latin : candidates).map(value=>value.replace(/\s+/g,' ').trim().toUpperCase());
    }
    const values = [...new Set(candidates)];
    // Disagreement must be reviewed, never resolved by guessing an identity.
    if (values.length === 1) result[key] = values[0];
  }
  return result;
}

export function normalizeNidContrast(pixels) {
  const histogram = new Uint32Array(256);
  for (let i=0; i<pixels.length; i+=4) {
    const grey = Math.round(pixels[i]*0.299 + pixels[i+1]*0.587 + pixels[i+2]*0.114);
    histogram[grey]++;
  }
  const total = pixels.length / 4;
  let low=0, high=255, count=0;
  while (low<255 && count+histogram[low] <= total*0.01) count+=histogram[low++];
  count=0;
  while (high>low && count+histogram[high] <= total*0.01) count+=histogram[high--];
  for (let i=0; i<pixels.length; i+=4) {
    const grey = pixels[i]*0.299 + pixels[i+1]*0.587 + pixels[i+2]*0.114;
    const value = high>low ? Math.max(0, Math.min(255, Math.round((grey-low)*255/(high-low)))) : Math.round(grey);
    pixels[i]=pixels[i+1]=pixels[i+2]=value;
  }
  return pixels;
}

export async function contrastNidImage(photo, local=false) {
  const url = URL.createObjectURL(photo);
  const canvas = document.createElement('canvas');
  try {
    const image = new Image();
    await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=()=>reject(new Error('decode')); image.src=url; });
    // Prepared photos are bounded to 2400px; keep OCR retry memory bounded too.
    const scale = local ? 1 : Math.min(2, 2400 / Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d', {willReadFrequently:true});
    if (!context) throw new Error('decode');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const data=context.getImageData(0,0,canvas.width,canvas.height);
    if(local) flattenNidPaper(data); else normalizeNidContrast(data.data);
    context.putImageData(data,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if (!blob) throw new Error('decode');
    return blob;
  } finally { URL.revokeObjectURL(url); canvas.width=canvas.height=0; }
}

export function flattenNidPaper({data,width,height}) {
  const stride=width+1, integral=new Float64Array(stride*(height+1));
  for(let y=0;y<height;y++) {
    let row=0;
    for(let x=0;x<width;x++) {const i=(y*width+x)*4;row+=Math.max(data[i],data[i+1],data[i+2]);integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}
  }
  const radius=Math.max(12,Math.round(width/40));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const left=Math.max(0,x-radius),right=Math.min(width,x+radius+1),top=Math.max(0,y-radius),bottom=Math.min(height,y+radius+1);
    const mean=(integral[bottom*stride+right]-integral[top*stride+right]-integral[bottom*stride+left]+integral[top*stride+left])/((right-left)*(bottom-top));
    const i=(y*width+x)*4,value=Math.max(0,Math.min(255,255-(mean-Math.max(data[i],data[i+1],data[i+2])-5)*5));
    data[i]=data[i+1]=data[i+2]=value;
  }
  return data;
}

export async function recognizeNid(worker, photo, { onPass=()=>{}, isActive=()=>true, enhance=contrastNidImage, isolate=isolateNidCard, cropName=cropNidName, prepare=prepareNidOcrImage, budgetMs=NID_OCR_BUDGET_MS, now=()=>performance.now() }={}) {
  const readings=[];
  const texts=[];
  const started=now();
  let nameSource, nameRegion, columnSource, columnRegion, pass=0, language='eng', timedOut=false;
  if (!isActive()) throw new Error('cancelled');
  const remaining=()=>Math.max(0,budgetMs-(now()-started));
  const available=()=>isActive() && remaining()>0 && !timedOut && pass<NID_OCR_PASSES;
  const fields = () => reconcileNidMrz(texts,{...mergeNidReadings(readings),name:chooseNidName(readings)});
  const record = (data, source, nameOnly=false, cropSource) => {
    texts.push(data.text || '');
    const parsed=parseNidText(data.text);
    if (nameOnly) parsed.name=parseNidNameCrop(data.text);
    readings.push(nameOnly ? {name:parsed.name,nameConfidence:nidNameEvidence(data,parsed.name)} : {...parsed,nameConfidence:nidNameEvidence(data,parsed.name)});
    // An unlabelled capitals line earns a confirming crop only if OCR was confident in it.
    const region=findNidNameRegion(data) || (!nameOnly && !nameRegion && readings.at(-1).nameConfidence>=70 ? findNidNameLine(data,parsed.name) : null);
    if (!nameOnly && region) { nameRegion=region; nameSource=cropSource || data.imageGrey || source; }
    const column=findNidTextColumn(data);
    if (!nameOnly && column) {columnRegion=column;columnSource=data.imageGrey || source;}
  };
  async function read(source, mode, lang, nameOnly=false, aligned=false, cropSource) {
    if (!isActive()) throw new Error('cancelled');
    if (!available()) return;
    onPass(++pass);
    let timer;
    try {
      const {data}=await Promise.race([
        (async()=>{
          if (language!==lang) { await worker.reinitialize(lang); language=lang; }
          await worker.setParameters({tessedit_pageseg_mode:mode,preserve_interword_spaces:'1'});
          // Name crops are already aligned to OCR coordinates. Auto-deskew on a
          // short two-line crop can rotate away valid text and wastes a layout pass.
          return worker.recognize(source,{rotateAuto:!nameOnly && !aligned},{text:true,blocks:true,imageGrey:!nameOnly});
        })(),
        new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true; worker.terminate(); reject(new Error('ocr-timeout'));},remaining());}),
      ]);
      if (!isActive()) throw new Error('cancelled');
      record(data,source,nameOnly,cropSource);
    } catch (error) {
      if (!isActive()) throw error;
      if (!readings.length && !timedOut) throw error;
    } finally { clearTimeout(timer); }
  }

  async function retryName() {
    if (fields().name || !nameRegion || !available()) return;
    try {
      const crop=await cropName(nameSource,nameRegion);
      await read(crop,'6','eng',true);
      if (!fields().name && available()) await read(await enhance(crop),'11','eng',true);
    } catch (error) { if (!isActive()) throw error; }
  }

  // Most cards need one English full-image pass and one small name crop. Do not
  // download OpenCV/Bengali or repeat full-image OCR unless that path fails.
  let sources=[photo];
  try { const prepared=await prepare(photo);sources=Array.isArray(prepared)?prepared:[prepared]; } catch { /* Preserve full-image fallback. */ }
  photo=sources[0] || photo;
  for(const source of sources.slice(0,2)) await read(source,'3','eng');
  await retryName();
  if (!Object.values(fields()).every(Boolean) && columnRegion && available()) {
    try {
      const column=await cropName(columnSource,columnRegion,{maxWidth:1800,maxHeight:1800});
      await read(await contrastNidImage(column,true),'6','eng+ben',false,true,column);
      await retryName();
    } catch (error) {if(!isActive())throw error;}
  }
  if (!Object.values(fields()).every(Boolean) && available()) {
    let focused=photo;
    try { focused=await isolate(photo,{timeoutMs:Math.min(4500,remaining())}); } catch { /* Keep the full photo on detection failure. */ }
    if (available()) {
      let enhanced=focused;
      try { enhanced=await enhance(focused); } catch { /* Retry the unmodified photo if enhancement fails. */ }
      await read(enhanced,'11','eng+ben');
      await retryName();
      if (!Object.values(fields()).every(Boolean) && available()) {
        await read(enhanced,'6','eng+ben');
        await retryName();
      }
    }
  }
  if (!isActive()) throw new Error('cancelled');
  return {fields:fields(),text:texts.join('\n\n'),passes:pass,elapsedMs:Math.round(now()-started),timedOut:timedOut || remaining()===0};
}
