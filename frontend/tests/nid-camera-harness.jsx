import React,{useState,useRef,useCallback,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import NidCameraScanner from '../src/components/NidCameraScanner';
import {recognizeNid} from '../src/lib/nidRecognition';
import '../src/index.css';

export function Harness(){
  const [mode,setMode]=useState('card'),[open,setOpen]=useState(false),[result,setResult]=useState(null),[status,setStatus]=useState('Idle'),[image,setImage]=useState('');
  const stream=useRef(),canvas=useRef(),frames=useRef(),captures=useRef(0);
  const permission=useRef(null);
  const [streamActive,setStreamActive]=useState(false);
  useEffect(()=>{const timer=setInterval(()=>setStreamActive(stream.current?.active??false),200);return()=>clearInterval(timer);},[]);
  const acquire=useCallback(async()=>{
    if(mode==='denied')throw new DOMException('Denied','NotAllowedError');
    if(mode==='pending')await new Promise(resolve=>{permission.current=resolve;});
    const surface=document.createElement('canvas');surface.width=1280;surface.height=800;canvas.current=surface;
    const ctx=surface.getContext('2d');
    function draw(time){
      ctx.fillStyle='#364152';ctx.fillRect(0,0,1280,800);
      const x=mode==='moving'?180+130*Math.sin(time/650):180;
      if(mode!=='blank'){
        ctx.save();if(mode==='blur')ctx.filter='blur(14px)';
        ctx.fillStyle='#fafaf8';ctx.fillRect(x,100,920,580);
        ctx.fillStyle='#111827';ctx.font='26px Arial';ctx.fillText('SYNTHETIC TEST - NOT A VALID ID',x+50,155);
        ctx.font='34px Arial';ctx.fillText('Name: NID OCR TEST PERSON',x+50,270);
        ctx.fillText('Date of Birth: 20 Feb 1990',x+50,390);
        ctx.fillText('NID No: 583 729 1640',x+50,510);ctx.restore();
      }
      if(!stream.current || stream.current.active)frames.current=requestAnimationFrame(draw);
    }
    stream.current=surface.captureStream(10);draw(0);return stream.current;
  },[mode]);
  async function captured(file){
    captures.current++;setOpen(false);setStatus('OCR running');setImage(URL.createObjectURL(file));
    cancelAnimationFrame(frames.current);
    const {createWorker}=await import('tesseract.js');
    const worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/tesseract-core-lstm.wasm.js',langPath:'/ocr'});
    try {setResult((await recognizeNid(worker,file)).fields);setStatus('Complete');}catch{setStatus('OCR error');}finally{await worker.terminate();}
  }
  return <main className="mx-auto max-w-2xl space-y-4 p-4"><h1 className="text-xl font-bold">Synthetic camera QA</h1>
    <label>Scenario<select className="input ml-3" value={mode} disabled={open} onChange={e=>setMode(e.target.value)}><option value="card">Readable card</option><option value="blank">Blank scene</option><option value="moving">Moving card</option><option value="blur">Blurred card</option><option value="denied">Permission denied</option><option value="pending">Delayed permission</option></select></label>
    {mode==='pending'&&<button onClick={()=>permission.current?.()}>Resolve pending permission</button>}
    <button className="min-h-11 rounded-lg border px-4" onClick={()=>{setResult(null);setOpen(true);setStatus('Scanning');}}>Start test camera</button>
    {open&&<NidCameraScanner acquireStream={acquire} onCapture={captured} onClose={()=>{setOpen(false);setStatus('Closed');}} onFallback={()=>{setOpen(false);setStatus('Fallback');}} />}
    <p role="status">{status}</p><p>Capture count: {captures.current}</p><p>Stream active: {String(streamActive)}</p>
    {image&&<img src={image} alt="Captured synthetic card" className="w-full"/>}
    {result&&<pre>{JSON.stringify(result,null,2)}</pre>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
