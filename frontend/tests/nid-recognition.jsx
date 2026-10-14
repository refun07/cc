import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createWorker} from 'tesseract.js';
import {prepareNidDocument} from '../src/lib/nidPhoto';
import {recognizeNid} from '../src/lib/nidRecognition';
import NidScanPreview from '../src/components/NidScanPreview';
import {makePhotoFixture, PHOTO_CASES, PHOTO_EXPECTED} from './nid-photo-fixtures';
import {cropNidName} from '../src/lib/nidOcrImage';
import '../src/index.css';

export default function RecognitionQa() {
  const [preview,setPreview]=useState(''), [busy,setBusy]=useState(false), [pass,setPass]=useState(1), [progress,setProgress]=useState(0), [result,setResult]=useState(null), [error,setError]=useState('');
  const [suite,setSuite]=useState([]), [suiteBusy,setSuiteBusy]=useState(false);
  const [selected,setSelected]=useState('dim-shadow'), [crops,setCrops]=useState([]), [fixtureUrl,setFixtureUrl]=useState('');
  async function read(file) {
    if (!file) return;
    setBusy(true); setResult(null); setError(''); setPass(1); setProgress(0); setCrops([]);
    let worker;
    const start=performance.now();
    try {
      const {image,ocrImage}=await prepareNidDocument(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(image));
      worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/tesseract-core-lstm.wasm.js',langPath:'/ocr',logger:m=>{if(m.status==='recognizing text')setProgress(Math.round(m.progress*100));}});
      const data=await recognizeNid(worker,ocrImage,{onPass:p=>{setPass(p);setProgress(0);},cropName:async(source,region,options)=>{const crop=await cropNidName(source,region,options);setCrops(previous=>[...previous,URL.createObjectURL(crop)]);return crop;}});
      setResult({...data,seconds:Math.round((performance.now()-start)/1000)});
      return {...data,totalMs:Math.round(performance.now()-start)};
    } catch (error) { setError(error.message); }
    finally { await worker?.terminate(); setBusy(false); }
  }
  async function runSuite() {
    setSuiteBusy(true); setSuite([]);
    try {
      for (const spec of PHOTO_CASES) {
        const photo = await makePhotoFixture(spec), data = await read(photo);
        const success = !!data?.fields && (spec.reject ? !Object.values(data.fields).some(Boolean) : Object.entries(spec.expected || PHOTO_EXPECTED).every(([key,value])=>data.fields[key]===value));
        setSuite(previous=>[...previous,{id:spec.id,label:spec.label,success,fields:data?.fields,totalMs:data?.totalMs,ocrMs:data?.elapsedMs,passes:data?.passes,timedOut:data?.timedOut,text:data?.text}]);
      }
    } finally { setSuiteBusy(false); }
  }
  async function runSelected() {
    const spec=PHOTO_CASES.find(item=>item.id===selected), photo=await makePhotoFixture(spec);
    if (fixtureUrl) URL.revokeObjectURL(fixtureUrl);
    setFixtureUrl(URL.createObjectURL(photo)); await read(photo);
  }
  return <main style={{maxWidth:640,margin:'24px auto',padding:16}}>
    <h1 className="mb-4 text-xl font-bold">NID recognition QA</h1>
    <label>Test document<input type="file" disabled={busy || suiteBusy} onChange={e=>{const file=e.target.files[0];e.target.value='';read(file);}} /></label>
    <button className="border p-2 my-3" disabled={busy || suiteBusy} onClick={runSuite}>Run photo stress suite</button>
    <select aria-label="Photo case" disabled={busy || suiteBusy} value={selected} onChange={event=>setSelected(event.target.value)}>{PHOTO_CASES.map(spec=><option key={spec.id} value={spec.id}>{spec.label}</option>)}</select>
    <button className="border p-2" disabled={busy || suiteBusy} onClick={runSelected}>Run selected photo</button>
    {fixtureUrl && <a href={fixtureUrl} download={`${selected}.jpg`}>Download synthetic photo</a>}
    <p role="status">{suiteBusy ? `Testing ${suite.length + 1}/${PHOTO_CASES.length}` : `${suite.length} cases completed`}</p>
    {!!suite.length && <pre data-testid="suite" className="whitespace-pre-wrap break-words">{JSON.stringify(suite,null,2)}</pre>}
    {(preview || busy) && <div className="mt-4"><NidScanPreview preview={preview} scanning={busy} progress={progress} pass={pass} lang="en" /></div>}
    {crops.map((url,i)=><img key={url} src={url} alt={`Name crop ${i+1}`} className="my-3 w-full" />)}
    {error && <p role="alert">{error}</p>}
    {result && <><pre className="my-4 whitespace-pre-wrap break-words" data-testid="result">{JSON.stringify({fields:result.fields,seconds:result.seconds,passes:result.passes,ocrMs:result.elapsedMs,timedOut:result.timedOut},null,2)}</pre><details><summary>Extracted text</summary><pre className="whitespace-pre-wrap">{result.text}</pre></details></>}
  </main>;
}
createRoot(document.getElementById('root')).render(<RecognitionQa />);
