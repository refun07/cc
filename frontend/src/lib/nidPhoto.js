const MAX_INPUT_BYTES = 24 * 1024 * 1024;
// Stay under nginx's default 1 MB request body (and PHP's 2 MB upload) limit:
// a detailed phone photo at 2400px can be 2-3 MB and would fail only on Save.
export const MAX_OUTPUT_BYTES = 950 * 1024;
const MAX_EDGE = 2400;
const MIN_EDGE = 1200;

export const NID_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.avif,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif';
// An image-only picker exposes the native photo library on iPhone and iPad.
export const NID_PHOTO_ACCEPT = 'image/*';

export function nidFileKind(file) {
  const extension = (file.name || '').split('.').pop().toLowerCase();
  const unknownType = !file.type || file.type === 'application/octet-stream';
  if (file.type === 'application/pdf' || (unknownType && extension === 'pdf')) return 'pdf';
  if (['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(file.type) || ((!file.type || file.type === 'application/octet-stream') && ['heic', 'heif'].includes(extension))) return 'heic';
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/x-ms-bmp', 'image/avif'].includes(file.type) || (unknownType && ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(extension))) return 'image';
  throw new Error('format');
}

const jpeg = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob?.size ? resolve(blob) : reject(new Error('decode')), 'image/jpeg', quality));

// OCR reads the full-quality JPEG: recompressing small print loses names. The
// retained copy lowers quality, then resolution, only as far as the upload limit needs.
export async function encodeNidJpeg(canvas) {
  const full = await jpeg(canvas, 0.92);
  if (full.size <= MAX_OUTPUT_BYTES) return { full, upload:full };
  for (let source = canvas; ; ) {
    for (const quality of source === canvas ? [0.85, 0.78, 0.7] : [0.92, 0.85, 0.78, 0.7]) {
      const upload = await jpeg(source, quality);
      if (upload.size <= MAX_OUTPUT_BYTES) return { full, upload };
    }
    if (Math.max(source.width, source.height) * .8 < MIN_EDGE) throw new Error('decode');
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(source.width * .8); smaller.height = Math.round(source.height * .8);
    const context = smaller.getContext('2d');
    if (!context) throw new Error('decode');
    context.drawImage(source, 0, 0, smaller.width, smaller.height);
    source = smaller;
  }
}

// Cheap checks that let the UI reject a wrong pick before clearing the current scan.
export function checkNidFile(file) {
  if (!file.size) throw new Error('empty');
  if (file.size > MAX_INPUT_BYTES) throw new Error('size');
  return nidFileKind(file);
}

export async function prepareNidDocument(file, pageNumber = 1) {
  const kind = checkNidFile(file);
  if (kind === 'pdf') {
    const { renderNidPdf } = await import('./nidPdf');
    return renderNidPdf(file, pageNumber);
  }
  if (kind === 'heic') {
    const { heicTo } = await import('heic-to/csp');
    const jpeg = await heicTo({ blob:file, type:'image/jpeg', quality:0.95 });
    file = new File([jpeg], 'nid-converted.jpg', { type:'image/jpeg' });
  }
  return { ...await prepareNidPhoto(file), pages:0, page:1 };
}

export async function prepareNidPhoto(file) {
  if (nidFileKind(file) !== 'image') throw new Error('format');
  if (!file.size) throw new Error('empty');
  if (file.size > MAX_INPUT_BYTES) throw new Error('size');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('decode'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('decode');
    // Bound mobile OCR memory and upload size without cropping the document.
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('decode');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { full, upload } = await encodeNidJpeg(canvas);
    // image is retained and previewed; ocrImage is only read in the browser.
    return { image:new File([upload], 'nid-photo.jpg', { type:'image/jpeg' }), ocrImage:new File([full], 'nid-photo-ocr.jpg', { type:'image/jpeg' }) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
