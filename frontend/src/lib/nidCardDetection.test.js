import test from 'node:test';
import assert from 'node:assert/strict';
import cvModule from '@techstark/opencv-js';
import {createCardStabilityGate,detectNidCard,warpNidCard,orderCardCorners,nidGuideRect} from './nidCardDetection.js';

const cv=await cvModule;
function fixture({blank=false,blur=false,clipped=false}={}) {
  const image=new cv.Mat(480,640,cv.CV_8UC4,new cv.Scalar(45,65,85,255));
  const x=clipped?-50:70;
  cv.rectangle(image,new cv.Point(x,80),new cv.Point(x+500,390),new cv.Scalar(245,245,235,255),-1);
  if(!blank) {
    for(const [i,line] of ['SYNTHETIC TEST CARD','Name: TEST PERSON','DOB: 20/02/1990','NID: 5837291640'].entries())
      cv.putText(image,line,new cv.Point(x+35,130+i*65),cv.FONT_HERSHEY_SIMPLEX,0.65,new cv.Scalar(15,15,15,255),2);
  }
  if(blur) cv.GaussianBlur(image,image,new cv.Size(31,31),8);
  const result={data:new Uint8ClampedArray(image.data),width:image.cols,height:image.rows};image.delete();return result;
}
test('OpenCV finds a text-bearing card and rectifies a crop',()=>{
  const image=fixture(), result=detectNidCard(cv,image);
  assert.equal(result.status,'ready'); assert.equal(result.corners.length,4);
  const cropped=warpNidCard(cv,image,result.corners);
  assert.ok(cropped.width>480 && cropped.height>290);
  assert.equal(cropped.data.length,cropped.width*cropped.height*4);
});
test('blank scene, blank rectangle, clipped card and blurred card never auto-capture',()=>{
  assert.notEqual(detectNidCard(cv,fixture({blank:true})).status,'ready');
  assert.notEqual(detectNidCard(cv,fixture({clipped:true})).status,'ready');
  assert.notEqual(detectNidCard(cv,fixture({blur:true})).status,'ready');
  const image={data:new Uint8ClampedArray(640*480*4).fill(128),width:640,height:480};
  assert.equal(detectNidCard(cv,image).status,'searching');
});
test('stability needs repeated unmoving detections and captures once',()=>{
  const gate=createCardStabilityGate(), result=detectNidCard(cv,fixture());
  assert.equal(gate(result,0).capture,false);
  assert.equal(gate(result,400).capture,false);
  assert.equal(gate(result,800).capture,false);
  assert.equal(gate(result,1200).capture,true);
  assert.equal(gate(result,2000).capture,false);
});
test('motion and missing/blurred cards reset the stability timer',()=>{
  const gate=createCardStabilityGate(), result=detectNidCard(cv,fixture());
  gate(result,0);gate(result,500);
  const moved={...result,corners:result.corners.map(p=>({...p,x:p.x+0.03}))};
  assert.equal(gate(moved,1200).progress,0);
  gate({status:'blurred'},1700);
  assert.equal(gate(result,2500).capture,false);
});
test('corner ordering remains top-left clockwise independent of contour start',()=>{
  assert.deepEqual(orderCardCorners([{x:8,y:5},{x:1,y:1},{x:1,y:5},{x:8,y:1}]),[{x:1,y:1},{x:8,y:1},{x:8,y:5},{x:1,y:5}]);
});
test('a slightly rotated card is detected and perspective-normalized',()=>{
  const original=fixture(),src=cv.matFromImageData(original),out=new cv.Mat();
  const rotation=cv.getRotationMatrix2D(new cv.Point(320,240),8,1);
  try {
    cv.warpAffine(src,out,rotation,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_REPLICATE);
    const image={data:new Uint8ClampedArray(out.data),width:640,height:480};
    assert.equal(detectNidCard(cv,image).status,'ready');
  } finally {src.delete();out.delete();rotation.delete();}
});
test('an upright card in a portrait frame asks to be turned and never auto-captures',()=>{
  const image=new cv.Mat(640,360,cv.CV_8UC4,new cv.Scalar(45,65,85,255));
  cv.rectangle(image,new cv.Point(45,100),new cv.Point(315,540),new cv.Scalar(245,245,235,255),-1);
  for(let i=0;i<4;i++) cv.putText(image,'NID 5837291640',new cv.Point(70,170+i*90),cv.FONT_HERSHEY_SIMPLEX,0.6,new cv.Scalar(15,15,15,255),2);
  try {
    const result=detectNidCard(cv,{data:new Uint8ClampedArray(image.data),width:360,height:640});
    assert.equal(result.status,'rotate');
    assert.equal(createCardStabilityGate()(result,0).capture,false);
  } finally {image.delete();}
});
test('a thumb over one corner still yields an outline covering the whole card',()=>{
  const original=fixture(),image=cv.matFromImageData(original);
  try {
    cv.circle(image,new cv.Point(570,390),30,new cv.Scalar(112,140,196,255),-1);
    const result=detectNidCard(cv,{data:new Uint8ClampedArray(image.data),width:640,height:480});
    assert.equal(result.status,'ready');
    const [tl,,br]=result.corners;
    assert.ok(tl.x<=72/640 && tl.y<=82/480 && br.x>=568/640 && br.y>=388/480 && br.x<0.95 && br.y<0.88);
  } finally {image.delete();}
});
test('the camera guide keeps an ID-card shape in portrait and landscape previews',()=>{
  for(const ratio of [9/16,3/4,4/3,16/9]) {
    const guide=nidGuideRect(ratio);
    assert.ok(Math.abs(guide.width*ratio/guide.height-1.586)<1e-9);
    assert.ok(guide.width<=0.86 && guide.height<=0.7 && guide.x>0 && guide.y>0);
  }
});
