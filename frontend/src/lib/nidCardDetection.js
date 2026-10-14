const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function orderCardCorners(points) {
  const center=points.reduce((sum,p)=>({x:sum.x+p.x/4,y:sum.y+p.y/4}),{x:0,y:0});
  const ordered=[...points].sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));
  const start=ordered.reduce((best,p,i)=>p.x+p.y<ordered[best].x+ordered[best].y?i:best,0);
  return [...ordered.slice(start),...ordered.slice(0,start)];
}

// Card-shaped guide in the preview's 0..1 coordinates, whatever the video orientation.
export function nidGuideRect(ratio, cardRatio=1.586) {
  let width=0.86, height=width*ratio/cardRatio;
  if(height>0.7) { height=0.7; width=height*cardRatio/ratio; }
  return {x:(1-width)/2,y:(1-height)/2,width,height};
}

export function createCardStabilityGate() {
  let anchor=null, since=0, count=0, captured=false;
  return (detection, now) => {
    if (captured) return {capture:false,progress:1};
    if (detection?.status!=='ready') { anchor=null; count=0; return {capture:false,progress:0}; }
    const points=detection.corners;
    if (!anchor || points.some((p,i)=>distance(p,anchor[i])>0.018)) { anchor=points; since=now; count=1; }
    else count++;
    const progress=Math.min(1,(now-since)/1200);
    if (progress===1 && count>=4) { captured=true; return {capture:true,progress}; }
    return {capture:false,progress};
  };
}

// A card outline must be a plausible, nearly rectangular quadrilateral. Returns
// its orientation, or null. Phones in portrait invite holding the card upright.
function cardShape(points,cols,rows) {
  if(points.some(p=>p.x<4 || p.y<4 || p.x>cols-5 || p.y>rows-5)) return null;
  const width=(distance(points[0],points[1])+distance(points[2],points[3]))/2;
  const height=(distance(points[1],points[2])+distance(points[3],points[0]))/2;
  const angles=points.map((p,j)=>{
    const a=points[(j+3)%4], b=points[(j+1)%4];
    return Math.abs(((a.x-p.x)*(b.x-p.x)+(a.y-p.y)*(b.y-p.y))/(distance(a,p)*distance(b,p)));
  });
  if(Math.max(...angles)>0.55) return null;
  const ratio=width/height;
  if(ratio>=1.25 && ratio<=2.15) return 'landscape';
  if(ratio>=1/2.15 && ratio<=1/1.25) return 'portrait';
  return null;
}

function findCardOutline(cv,edges,cols,rows) {
  const contours=new cv.MatVector(), hierarchy=new cv.Mat();
  let best=null;
  try {
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    for(let i=0;i<contours.size();i++) {
      const contour=contours.get(i), polygon=new cv.Mat();
      try {
        const area=cv.contourArea(contour), fraction=area/(cols*rows);
        if(fraction<0.16 || fraction>0.88 || area<=(best?.area || 0)) continue;
        cv.approxPolyDP(contour,polygon,0.025*cv.arcLength(contour,true),true);
        let points=null;
        if(polygon.rows===4 && cv.isContourConvex(polygon)) {
          points=Array.from({length:4},(_,j)=>({x:polygon.data32S[j*2],y:polygon.data32S[j*2+1]}));
        } else {
          // A thumb over one corner breaks the quadrilateral. Recover the corner only
          // when the outline still fills almost all of its rotated bounding box.
          const box=cv.minAreaRect(contour);
          if(area/(box.size.width*box.size.height)<0.9) continue;
          points=cv.RotatedRect.points(box).map(p=>({x:Math.round(p.x),y:Math.round(p.y)}));
        }
        points=orderCardCorners(points);
        const orientation=cardShape(points,cols,rows);
        if(orientation) best={points,area,orientation};
      } finally { polygon.delete(); contour.delete(); }
    }
    return best;
  } finally { contours.delete(); hierarchy.delete(); }
}

// OpenCV handles contours and perspective geometry. Keep WASM allocations local.
export function detectNidCard(cv, image) {
  const src=cv.matFromImageData(image), gray=new cv.Mat(), smooth=new cv.Mat(), edges=new cv.Mat();
  const kernel=cv.Mat.ones(3,3,cv.CV_8U);
  try {
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray,smooth,new cv.Size(5,5),0);
    let found=null;
    // A pale card on a light table has faint, broken edges: close the gaps and
    // retry with lower thresholds before giving up.
    for(const [low,high] of [[40,120],[15,45]]) {
      cv.Canny(smooth,edges,low,high);
      cv.dilate(edges,edges,kernel);
      found=findCardOutline(cv,edges,src.cols,src.rows);
      if(found) break;
    }
    if(!found) return {status:'searching',corners:null};
    const corners=found.points.map(p=>({x:p.x/src.cols,y:p.y/src.rows}));
    if(found.orientation==='portrait') return {status:'rotate',corners};
    const crop=warpNidCard(cv,image,corners,480);
    const card=cv.matFromImageData(crop), cardGray=new cv.Mat(), laplacian=new cv.Mat(), mean=new cv.Mat(), deviation=new cv.Mat(), cardEdges=new cv.Mat();
    let inner;
    try {
      cv.cvtColor(card,cardGray,cv.COLOR_RGBA2GRAY);
      inner=cardGray.roi(new cv.Rect(16,16,card.cols-32,card.rows-32));
      const brightness=cv.mean(inner)[0];
      cv.Laplacian(inner,laplacian,cv.CV_64F);
      cv.meanStdDev(laplacian,mean,deviation);
      cv.Canny(inner,cardEdges,50,150);
      const detail=cv.countNonZero(cardEdges)/(inner.cols*inner.rows);
      const sharpness=deviation.data64F[0]**2;
      const status=brightness<45 ? 'dark' : detail<0.006 ? 'no-text' : sharpness<55 ? 'blurred' : 'ready';
      return {status,corners,sharpness};
    } finally { inner?.delete(); card.delete(); cardGray.delete(); laplacian.delete(); mean.delete(); deviation.delete(); cardEdges.delete(); }
  } finally { src.delete(); gray.delete(); smooth.delete(); edges.delete(); kernel.delete(); }
}

export function warpNidCard(cv,image,corners,maxWidth=1600) {
  const points=corners.map(p=>({x:p.x*image.width,y:p.y*image.height}));
  const width=Math.max(distance(points[0],points[1]),distance(points[2],points[3]));
  const height=Math.max(distance(points[1],points[2]),distance(points[3],points[0]));
  const outWidth=Math.max(64,Math.min(maxWidth,Math.round(width)));
  const outHeight=Math.max(48,Math.round(outWidth*height/width));
  const src=cv.matFromImageData(image), out=new cv.Mat();
  const from=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]));
  const to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outWidth-1,0,outWidth-1,outHeight-1,0,outHeight-1]);
  let transform;
  try {
    transform=cv.getPerspectiveTransform(from,to);
    cv.warpPerspective(src,out,transform,new cv.Size(outWidth,outHeight),cv.INTER_CUBIC,cv.BORDER_REPLICATE);
    return {data:new Uint8ClampedArray(out.data),width:out.cols,height:out.rows};
  } finally { transform?.delete(); src.delete(); out.delete(); from.delete(); to.delete(); }
}
