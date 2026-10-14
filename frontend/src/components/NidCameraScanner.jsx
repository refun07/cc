import { useEffect, useRef, useState } from 'react';
import { Aperture, Camera, ScanLine, X } from 'lucide-react';
import { createCardStabilityGate, nidGuideRect } from '../lib/nidCardDetection';

// Ask for a 4:3 frame: in portrait it is wider than 16:9, so the card gets more pixels.
const requestCamera=()=>navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}}});
const CAPTURE_EDGE=2400;

export default function NidCameraScanner({onCapture,onClose,onFallback,lang='en',acquireStream=requestCamera}) {
  const video=useRef(null), section=useRef(null), captureRef=useRef(null), callbacks=useRef({onCapture,onClose,onFallback});
  callbacks.current={onCapture,onClose,onFallback};
  const [state,setState]=useState({status:'loading',corners:null,progress:0});
  const [ratio,setRatio]=useState(3/4);
  const tr=(en,bn)=>lang==='bn'?bn:en;
  useEffect(()=>{section.current?.scrollIntoView?.({block:'start'});},[]);
  useEffect(()=>{
    let active=true, capturing=false, stream, worker, timer, watchdog, engineReady=false;
    const full=document.createElement('canvas'), small=document.createElement('canvas');
    const smallContext=small.getContext('2d',{willReadFrequently:true});
    const stable=createCardStabilityGate();
    function stopWorker() { worker?.terminate(); worker=null; engineReady=false; }
    function release() {
      clearTimeout(timer); clearTimeout(watchdog);
      stopWorker();
      stream?.getTracks().forEach(track=>track.stop());
      if(video.current) video.current.srcObject=null;
      full.width=full.height=small.width=small.height=0;
    }
    function fail(status) { if(!active)return; active=false; release(); setState({status,corners:null,progress:0}); }
    // Detection is an aid. If it cannot start or crashes, keep the camera and manual capture.
    function manual() {
      if(!active || capturing)return;
      clearTimeout(timer); clearTimeout(watchdog); stopWorker();
      setState({status:'manual',corners:null,progress:0});
    }
    function deliver(canvas) {
      canvas.toBlob(blob=>{
        canvas.width=canvas.height=0;
        if(!active)return;
        if(!blob) {fail('failed');return;}
        active=false;release();
        callbacks.current.onCapture(new File([blob],'nid-camera.jpg',{type:'image/jpeg'}));
      },'image/jpeg',0.92);
    }
    function capture(corners) {
      const source=video.current;
      if(!active || capturing || !source?.videoWidth)return;
      capturing=true; clearTimeout(timer); clearTimeout(watchdog);
      setState(current=>({...current,status:'capturing',progress:1}));
      const scale=Math.min(1,CAPTURE_EDGE/Math.max(source.videoWidth,source.videoHeight));
      full.width=Math.round(source.videoWidth*scale); full.height=Math.round(source.videoHeight*scale);
      const context=full.getContext('2d',{willReadFrequently:!!corners});
      context.drawImage(source,0,0,full.width,full.height);
      stream.getTracks().forEach(track=>track.stop());
      if(!corners || !worker || !engineReady) {deliver(full);return;}
      // The full frame is kept as the fallback if perspective correction fails.
      const frame=context.getImageData(0,0,full.width,full.height);
      worker.onmessage=({data})=>{
        if(!active)return;
        clearTimeout(watchdog);
        if(data.type!=='captured') {deliver(full);return;}
        const canvas=document.createElement('canvas');
        canvas.width=data.image.width; canvas.height=data.image.height;
        canvas.getContext('2d').putImageData(new ImageData(data.image.data,data.image.width,data.image.height),0,0);
        deliver(canvas);
      };
      worker.postMessage({type:'capture',image:frame,corners},[frame.data.buffer]);
      watchdog=setTimeout(()=>{if(active)deliver(full);},10000);
    }
    // A tap shakes the phone; let the frame settle before grabbing it.
    captureRef.current=()=>{ if(!capturing) setTimeout(()=>capture(null),250); };
    function schedule() { timer=setTimeout(sample,350); }
    function sample() {
      if(!active || capturing || !worker || !engineReady || !stream) return;
      const source=video.current;
      if(!source || source.readyState<2 || !source.videoWidth) {schedule();return;}
      try {
        const down=Math.min(1,640/Math.max(source.videoWidth,source.videoHeight));
        small.width=Math.round(source.videoWidth*down); small.height=Math.round(source.videoHeight*down);
        smallContext.drawImage(source,0,0,small.width,small.height);
        const image=smallContext.getImageData(0,0,small.width,small.height);
        worker.postMessage({type:'detect',image},[image.data.buffer]);
        watchdog=setTimeout(manual,10000);
      } catch {manual();}
    }
    async function start() {
      try {
        if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {fail('unavailable');return;}
        watchdog=setTimeout(()=>fail('unavailable'),30000);
        stream=await acquireStream();
        if(!active) {release();return;}
        stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(!capturing)fail('unavailable');},{once:true}));
        video.current.srcObject=stream;
        await video.current.play();
        if(!active)return;
        clearTimeout(watchdog);
        setRatio(video.current.videoWidth/video.current.videoHeight || 3/4);
        setState({status:'starting',corners:null,progress:0});
        try {
          worker=new Worker(new URL('../workers/nidCard.worker.js',import.meta.url),{type:'module'});
        } catch {manual();return;}
        worker.onerror=manual;
        worker.onmessage=({data})=>{
          if(!active || capturing)return;
          clearTimeout(watchdog);
          if(data.type==='ready') {engineReady=true;setState({status:'searching',corners:null,progress:0});sample();}
          else if(data.type==='error') manual();
          else if(data.type==='detection') {
            const gate=stable(data.result,performance.now());
            setState({...data.result,progress:gate.progress});
            if(gate.capture) capture(data.result.corners);
            else schedule();
          }
        };
        // OpenCV is large; on a slow connection the user can capture manually meanwhile.
        watchdog=setTimeout(manual,45000);
        worker.postMessage({type:'init',url:new URL(`${import.meta.env.BASE_URL}ocr/opencv-5.0.0.js`,window.location.origin).href});
      } catch(err) {fail(err.name==='NotAllowedError'?'denied':'unavailable');}
    }
    function suspend() {active=false;release();callbacks.current.onClose();}
    function hidden() {if(document.hidden)suspend();}
    document.addEventListener('visibilitychange',hidden);
    window.addEventListener('pagehide',suspend);
    start();
    return ()=>{active=false;captureRef.current=null;release();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',suspend);};
  },[acquireStream]);
  const error=['denied','unavailable','failed'].includes(state.status);
  const live=!error && !['loading','capturing'].includes(state.status);
  const guide=nidGuideRect(ratio);
  const messages={
    loading:tr('Starting camera…','ক্যামেরা চালু হচ্ছে…'),
    starting:tr('Hold the card flat inside the frame. Automatic detection is starting; you can tap Capture now.','কার্ডটি ফ্রেমের ভেতরে সোজা করে ধরুন। স্বয়ংক্রিয় শনাক্তকরণ চালু হচ্ছে; এখনই ক্যাপচার চাপতে পারেন।'),
    searching:tr('Fit the whole card inside the frame. It captures automatically, or tap Capture.','পুরো কার্ডটি ফ্রেমের ভেতরে রাখুন। ছবি নিজে থেকেই উঠবে, অথবা ক্যাপচার চাপুন।'),
    ready:tr('Card detected. Hold steady…','কার্ড পাওয়া গেছে। স্থির রাখুন…'),
    rotate:tr('Turn the card sideways so it lies flat across the frame.','কার্ডটি আড়াআড়ি করে ফ্রেমের ভেতরে রাখুন।'),
    capturing:tr('Card captured','কার্ডের ছবি নেওয়া হয়েছে'),
    dark:tr('Not enough light','আলো কম'),
    blurred:tr('Card is not in focus. Hold the phone a little farther away.','কার্ডের ছবি ঝাপসা। ফোনটি একটু দূরে ধরুন।'),
    'no-text':tr('Text is not clear','লেখা পরিষ্কার নয়'),
    manual:tr('Fit the whole card inside the frame and tap Capture.','পুরো কার্ডটি ফ্রেমের ভেতরে রেখে ক্যাপচার চাপুন।'),
    denied:tr('Camera permission was denied. Allow camera access in browser settings, or take a photo instead.','ক্যামেরার অনুমতি দেওয়া হয়নি। ব্রাউজার সেটিংসে অনুমতি দিন, অথবা সরাসরি ছবি তুলুন।'),
    unavailable:tr('Camera is unavailable. Take a photo instead.','ক্যামেরা পাওয়া যায়নি। সরাসরি ছবি তুলুন।'),
    failed:tr('The photo could not be captured. Take a photo instead.','ছবি নেওয়া যায়নি। সরাসরি ছবি তুলুন।'),
  };
  const outline=state.status==='ready'?'#34d399':state.status==='rotate'?'#f87171':'#fbbf24';
  return <section ref={section} aria-label={tr('Automatic NID scanner','স্বয়ংক্রিয় এনআইডি স্ক্যানার')} className="scroll-mt-20 space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><ScanLine className="h-5 w-5" />{tr('Automatic NID scanner','স্বয়ংক্রিয় এনআইডি স্ক্যানার')}</h3><button type="button" aria-label={tr('Close camera','ক্যামেরা বন্ধ করুন')} title={tr('Close camera','ক্যামেরা বন্ধ করুন')} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"><X className="h-5 w-5" /></button></div>
    {!error && <div className="relative mx-auto overflow-hidden rounded-lg bg-black" style={{aspectRatio:ratio,width:`min(100%, calc(58vh * ${ratio}))`}}>
      <video ref={video} autoPlay muted playsInline aria-label={tr('Live camera preview','ক্যামেরার লাইভ ছবি')} className="absolute inset-0 h-full w-full object-contain" />
      <svg aria-hidden="true" viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {state.corners ? <polygon points={state.corners.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={outline} strokeWidth="3" vectorEffect="non-scaling-stroke" /> : <rect x={guide.x} y={guide.y} width={guide.width} height={guide.height} fill="none" stroke="white" strokeDasharray="8 6" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>}
    <p role={error?'alert':'status'} className={`text-sm ${error?'text-red-700':'text-brand-700'}`}>{messages[state.status]}</p>
    {state.status==='ready' && <progress className="h-2 w-full accent-emerald-600" aria-label={tr('Steady card','স্থির কার্ড')} value={state.progress} max="1" />}
    <div className="flex flex-wrap gap-3">
      {!error && <button type="button" disabled={!live} onClick={()=>captureRef.current?.()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white disabled:opacity-50"><Aperture className="h-5 w-5" />{tr('Capture','ক্যাপচার')}</button>}
      <button type="button" disabled={state.status==='capturing'} onClick={onFallback} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 disabled:opacity-50"><Camera className="h-4 w-4" />{tr('Take photo instead','সরাসরি ছবি তুলুন')}</button>
    </div>
  </section>;
}
