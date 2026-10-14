const MAX_INPUT_BYTES = 24 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;
const MAX_EDGE = 2400;

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

export async function prepareNidDocument(file, pageNumber = 1) {
  if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error('size');
  const kind = nidFileKind(file);
  if (kind === 'pdf') {
    const { renderNidPdf } = await import('./nidPdf');
    return renderNidPdf(file, pageNumber);
  }
  if (kind === 'heic') {
    const { heicTo } = await import('heic-to/csp');
    const jpeg = await heicTo({ blob:file, type:'image/jpeg', quality:0.95 });
    file = new File([jpeg], 'nid-converted.jpg', { type:'image/jpeg' });
  }
  return { image:await prepareNidPhoto(file), pages:0, page:1 };
}

export async function prepareNidPhoto(file) {
  if (nidFileKind(file) !== 'image') throw new Error('format');
  if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error('size');
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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob?.size || blob.size > MAX_OUTPUT_BYTES) throw new Error('decode');
    return new File([blob], 'nid-photo.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
