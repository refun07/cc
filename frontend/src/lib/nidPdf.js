import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf/pdf-worker-${version}.js`;

export async function renderNidPdf(file, pageNumber) {
  const assets = `${import.meta.env.BASE_URL}pdf/`;
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported:false,
    cMapUrl:`${assets}cmaps/`, cMapPacked:true,
    standardFontDataUrl:`${assets}standard_fonts/`, wasmUrl:`${assets}wasm/`,
  });
  try {
    const pdf = await task.promise;
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) throw new Error('page');
    const page = await pdf.getPage(pageNumber);
    const original = page.getViewport({ scale:1 });
    const viewport = page.getViewport({ scale:2400 / Math.max(original.width, original.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext:canvas.getContext('2d'), viewport, background:'#ffffff' }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob?.size || blob.size > 6 * 1024 * 1024) throw new Error('decode');
    return { image:new File([blob], `nid-page-${pageNumber}.jpg`, { type:'image/jpeg' }), pages:pdf.numPages, page:pageNumber };
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('password');
    throw error;
  } finally { await task.destroy(); }
}
