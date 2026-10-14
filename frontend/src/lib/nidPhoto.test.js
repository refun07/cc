import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNidPhoto, nidFileKind, NID_PHOTO_ACCEPT } from './nidPhoto.js';

test('photo library allows the native image picker and recognizes iPhone image types', () => {
  assert.equal(NID_PHOTO_ACCEPT, 'image/*');
  for (const type of ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']) {
    assert.equal(nidFileKind({name:'IMG_0001.HEIC',type}), 'heic');
  }
  assert.equal(nidFileKind({name:'IMG_0001.HEIF',type:'application/octet-stream'}), 'heic');
  assert.equal(nidFileKind({name:'IMG_0001.JPG',type:'image/jpeg'}), 'image');
});

test('recognizes PDF and common image formats without accepting executable documents', () => {
  assert.equal(nidFileKind({type:'application/pdf'}),'pdf');
  assert.equal(nidFileKind({name:'NID.PDF',type:'application/octet-stream'}),'pdf');
  assert.equal(nidFileKind({name:'photo.HEIC',type:''}),'heic');
  for (const type of ['jpeg','png','webp','gif','bmp','avif']) assert.equal(nidFileKind({type:`image/${type}`}),'image');
  for (const type of ['image/svg+xml','text/html','application/javascript']) assert.throws(()=>nidFileKind({type,name:'fake.jpg'}),/format/);
});

test('camera photo preparation preserves aspect ratio, limits memory and rejects invalid files', async (t) => {
  let dimensions = [8000, 6000];
  let broken = false;
  let output = new Blob(['jpeg'], { type:'image/jpeg' });
  let revoked = 0;
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (callback) => callback(output) };
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', () => { revoked++; });
  const oldImage = globalThis.Image;
  const oldDocument = globalThis.document;
  globalThis.Image = class {
    set src(_) {
      [this.naturalWidth, this.naturalHeight] = dimensions;
      queueMicrotask(() => broken ? this.onerror() : this.onload());
    }
  };
  globalThis.document = { createElement: () => canvas };
  t.after(() => { globalThis.Image = oldImage; globalThis.document = oldDocument; });
  const photo = { type:'image/jpeg', size:12 * 1024 * 1024 };
  const prepared = await prepareNidPhoto(photo);
  assert.deepEqual([canvas.width, canvas.height], [2400, 1800]);
  assert.equal(prepared.type, 'image/jpeg');
  assert.equal(prepared.name, 'nid-photo.jpg');
  dimensions = [1200, 1800];
  await prepareNidPhoto(photo);
  assert.deepEqual([canvas.width, canvas.height], [1200, 1800]);
  await assert.rejects(prepareNidPhoto({ type:'image/heic', size:100 }), /format/);
  await assert.rejects(prepareNidPhoto({ ...photo, size:25 * 1024 * 1024 }), /size/);
  await assert.rejects(prepareNidPhoto({ ...photo, size:0 }), /size/);
  broken = true;
  await assert.rejects(prepareNidPhoto(photo), /decode/);
  broken = false;
  output = null;
  await assert.rejects(prepareNidPhoto(photo), /decode/);
  assert.equal(revoked, 4, 'all decoded or failed object URLs are released');
});
