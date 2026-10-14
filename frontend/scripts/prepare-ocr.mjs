import { mkdirSync, copyFileSync, cpSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(`${root}node_modules/pdfjs-dist/${folder}`, `${root}public/pdf/${folder}`, { recursive:true });
}
const pdfVersion = JSON.parse(readFileSync(`${root}node_modules/pdfjs-dist/package.json`, 'utf8')).version;
copyFileSync(`${root}node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs`, `${root}public/pdf/pdf-worker-${pdfVersion}.js`);
mkdirSync(`${root}public/ocr`, { recursive: true });
copyFileSync(`${root}node_modules/@techstark/opencv-js/dist/opencv.js`, `${root}public/ocr/opencv-5.0.0.js`);
copyFileSync(`${root}node_modules/@techstark/opencv-js/LICENSE`, `${root}public/ocr/opencv-LICENSE.txt`);
for (const name of ['tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm']) {
  copyFileSync(`${root}node_modules/tesseract.js-core/${name}`, `${root}public/ocr/${name}`);
}
copyFileSync(`${root}node_modules/tesseract.js/dist/worker.min.js`, `${root}public/ocr/worker.min.js`);
for (const lang of ['eng','ben']) {
  copyFileSync(`${root}node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${root}public/ocr/${lang}.traineddata.gz`);
}
