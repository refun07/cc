import { detectNidCard, warpNidCard } from '../lib/nidCardDetection.js';

let cv;
self.onmessage=async ({data})=>{
  try {
    if(data.type==='init') {
      await import(/* @vite-ignore */ data.url);
      cv=await self.cv;
      if(!cv?.Mat) throw new Error('runtime');
      self.postMessage({type:'ready'});
    } else if(data.type==='detect') {
      self.postMessage({type:'detection',result:detectNidCard(cv,data.image)});
    } else if(data.type==='capture') {
      const image=warpNidCard(cv,data.image,data.corners);
      self.postMessage({type:'captured',image},[image.data.buffer]);
    }
  } catch { self.postMessage({type:'error'}); }
};
