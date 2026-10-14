async function readPhoto(photo) {
  const objectUrl = typeof photo !== 'string';
  const url = objectUrl ? URL.createObjectURL(photo) : photo;
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('decode')); image.src = url; });
    return image;
  } finally { if (objectUrl) URL.revokeObjectURL(url); }
}

const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('decode')), 'image/png'));

export function nidContentBounds({data,width,height}) {
  let x0=width,y0=height,x1=0,y1=0;
  for (let y=0;y<height;y++) {
    let count=0,left=width,right=0;
    for (let x=0;x<width;x++) {
      const i=(y*width+x)*4;
      if (data[i+3]>0 && Math.min(data[i],data[i+1],data[i+2])<225) {count++;left=Math.min(left,x);right=x;}
    }
    if (count<width*.04) continue;
    x0=Math.min(x0,left);x1=Math.max(x1,right);y0=Math.min(y0,y);y1=y;
  }
  if (x1-x0<width*.25 || y1-y0<height*.1) return null;
  const pad=Math.max(8,Math.round(Math.min(width,height)*.015));
  return {x0:Math.max(0,x0-pad),y0:Math.max(0,y0-pad),x1:Math.min(width,x1+pad+1),y1:Math.min(height,y1+pad+1)};
}

export function nidContentRegions(image) {
  const {data,width,height}=image, bounds=nidContentBounds(image);
  if (!bounds) return [];
  const runs=[];let start=-1,last=-1;
  const gap=Math.max(16,Math.round(height*.025));
  for(let y=0;y<height;y++) {
    let count=0;
    for(let x=0;x<width;x++) {const i=(y*width+x)*4;if(data[i+3] && Math.min(data[i],data[i+1],data[i+2])<225)count++;}
    if(count>=width*.04) {if(start<0)start=y;last=y;}
    else if(start>=0 && y-last>=gap) {runs.push([start,last]);start=-1;}
  }
  if(start>=0)runs.push([start,last]);
  const cards=runs.filter(([top,bottom])=>{const ratio=(bounds.x1-bounds.x0)/(bottom-top+1);return ratio>=1.25 && ratio<=2.3;});
  // Split only two clearly separated, card-shaped bands. Keep all other layouts
  // intact rather than accidentally dropping a line or choosing one identity.
  if(runs.length!==2 || cards.length!==2)return [bounds];
  return cards.map(([top,bottom])=>({...bounds,y0:Math.max(0,top-10),y1:Math.min(height,bottom+11)}));
}

export async function prepareNidOcrImage(photo) {
  const image=await readPhoto(photo), canvas=document.createElement('canvas');
  try {
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0);
    const regions=nidContentRegions(context.getImageData(0,0,canvas.width,canvas.height));
    if (!regions.length) return photo;
    if (regions.length===1 && (regions[0].x1-regions[0].x0)*(regions[0].y1-regions[0].y0)>canvas.width*canvas.height*.9) return photo;
    const photos=[];
    for(const bounds of regions) {
      const width=bounds.x1-bounds.x0,height=bounds.y1-bounds.y0;
      const scale=Math.min(3,2000/Math.max(width,height));
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      context.drawImage(image,bounds.x0,bounds.y0,width,height,0,0,canvas.width,canvas.height);
      photos.push(await png(canvas));
    }
    return photos;
  } finally {canvas.width=canvas.height=0;}
}

// OCR can use a rectified card, but the retained profile image stays untouched.
export async function isolateNidCard(photo, {timeoutMs=4500}={}) {
  const image = await readPhoto(photo);
  const full = document.createElement('canvas'), small = document.createElement('canvas');
  let worker, timeout;
  try {
    full.width = image.naturalWidth; full.height = image.naturalHeight;
    full.getContext('2d').drawImage(image, 0, 0);
    const scale = Math.min(1, 800 / Math.max(full.width, full.height));
    small.width = Math.round(full.width * scale); small.height = Math.round(full.height * scale);
    small.getContext('2d').drawImage(full, 0, 0, small.width, small.height);
    const card = await new Promise((resolve, reject) => {
      worker = new Worker(new URL('../workers/nidCard.worker.js', import.meta.url), { type: 'module' });
      timeout = setTimeout(() => reject(new Error('card-timeout')), timeoutMs);
      worker.onerror = () => reject(new Error('card-worker'));
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') worker.postMessage({ type: 'detect', image: small.getContext('2d').getImageData(0, 0, small.width, small.height) });
        else if (data.type === 'detection') {
          if (!data.result.corners || !['ready', 'blurred'].includes(data.result.status)) return resolve(null);
          worker.postMessage({ type: 'capture', image: full.getContext('2d').getImageData(0, 0, full.width, full.height), corners: data.result.corners });
        } else if (data.type === 'captured') resolve(data.image);
        else reject(new Error('card-worker'));
      };
      worker.postMessage({ type: 'init', url: new URL(`${import.meta.env.BASE_URL}ocr/opencv-5.0.0.js`, window.location.origin).href });
    });
    if (!card) return photo;
    full.width = card.width; full.height = card.height;
    full.getContext('2d').putImageData(new ImageData(card.data, card.width, card.height), 0, 0);
    return await png(full);
  } finally {
    clearTimeout(timeout); worker?.terminate(); full.width = full.height = small.width = small.height = 0;
  }
}

export async function cropNidName(photo, region, {maxWidth=1800,maxHeight=600}={}) {
  const image = await readPhoto(photo), canvas = document.createElement('canvas');
  try {
    const x = Math.max(0, Math.floor(region.x0)), y = Math.max(0, Math.floor(region.y0));
    const width = Math.min(image.naturalWidth - x, Math.ceil(region.x1 - x));
    const height = Math.min(image.naturalHeight - y, Math.ceil(region.y1 - y));
    if (width < 20 || height < 8) throw new Error('name-region');
    const scale = Math.min(4, maxWidth / width, maxHeight / height);
    canvas.width = Math.round(width * scale) + 32; canvas.height = Math.round(height * scale) + 32;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    context.drawImage(image, x, y, width, height, 16, 16, width * scale, height * scale);
    // White padding around a dim card makes global OCR thresholding classify the
    // entire crop as ink. Match its paper tone instead; omit transparent padding.
    const pixels=context.getImageData(16,16,canvas.width-32,canvas.height-32).data;
    const background=nidCropBackground(pixels);
    context.globalCompositeOperation='destination-over';
    context.fillStyle=`rgb(${background},${background},${background})`;
    context.fillRect(0,0,canvas.width,canvas.height);
    return await png(canvas);
  } finally { canvas.width = canvas.height = 0; }
}

export function nidCropBackground(pixels) {
  const histogram=new Uint32Array(256);
  let count=0;
  for (let i=0;i<pixels.length;i+=16) {
    if (!pixels[i+3]) continue;
    histogram[Math.round(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)]++;
    count++;
  }
  if (!count) return 255;
  let cumulative=0;
  for (let value=0;value<256;value++) {
    cumulative+=histogram[value];
    if (cumulative>=count*.9) return value;
  }
  return 255;
}
