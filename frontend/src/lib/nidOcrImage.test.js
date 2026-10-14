import test from 'node:test';
import assert from 'node:assert/strict';
import {nidCropBackground,nidContentRegions} from './nidOcrImage.js';

test('name padding matches dark paper rather than injecting white',()=>{
  const data=new Uint8ClampedArray(100*4);
  for(let i=0;i<100;i++)data.set([i<25?20:115,i<25?20:115,i<25?20:115,255],i*4);
  assert.equal(nidCropBackground(data),115);
});
test('white paper and transparent crops have safe borders',()=>{
  assert.equal(nidCropBackground(new Uint8ClampedArray([255,255,255,255])),255);
  assert.equal(nidCropBackground(new Uint8ClampedArray(64)),255);
});
test('two card-shaped bands are both retained and plain margins are excluded',()=>{
  const width=200,height=500,data=new Uint8ClampedArray(width*height*4).fill(255);
  for(const start of [40,200])for(let y=start;y<start+110;y++)for(let x=5;x<195;x++)data.set([180,195,170,255],(y*width+x)*4);
  const regions=nidContentRegions({data,width,height});
  assert.equal(regions.length,2);
  assert.ok(regions[0].y0<40 && regions[0].y1>149);
  assert.ok(regions[1].y0<200 && regions[1].y1>309 && regions[1].y1<400);
  assert.deepEqual(nidContentRegions({width,height,data:new Uint8ClampedArray(width*height*4).fill(255)}),[]);
});
