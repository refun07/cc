import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Upload, Save, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useT } from '../store/langStore';
import { formatNidBirthDate, parseNidBirthDate } from '../lib/nidOcr';
import { recognizeNid } from '../lib/nidRecognition';
import { isNidProfileComplete, isPlausibleNid, normalizeNidInput } from '../lib/nid';
import { checkNidFile, prepareNidDocument, NID_FILE_ACCEPT, NID_PHOTO_ACCEPT } from '../lib/nidPhoto';
import NidCameraScanner from './NidCameraScanner';
import NidUploadGuide from './NidUploadGuide';
import NidScanPreview from './NidScanPreview';

export default function NidProfile({ userId, onSaved }) {
  const { lang } = useT();
  const tr = (en, bn) => lang === 'bn' ? bn : en;
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [pdfSource, setPdfSource] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ name:'', date_of_birth:'', nid_number:'' });
  const [birthInput, setBirthInput] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrPass, setOcrPass] = useState(1);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const upload = useRef(null);
  const photos = useRef(null);
  const camera = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const workerRef = useRef(null);
  const mounted = useRef(true);
  const runRef = useRef(0);
  const savingRef = useRef(false);
  const savedUrl = useRef('');
  const alertRef = useRef(null);
  const base = `/users/${userId}/identity`;
  const canConfirm = !!file && !busy && !cameraOpen && !loading && !saved && isNidProfileComplete(form);
  // Shows the retained record; also used when Save finds one already exists.
  async function loadSaved(active = () => mounted.current) {
    const { data } = await api.get(base);
    if (!active()) return null;
    setSaved(data.data);
    if (data.data) {
      const image = await api.get(`${base}/image`, { responseType:'blob' });
      if (!active()) return data.data;
      if (savedUrl.current) URL.revokeObjectURL(savedUrl.current);
      savedUrl.current = URL.createObjectURL(image.data); setPreview(savedUrl.current);
    }
    return data.data;
  }
  useEffect(() => {
    mounted.current = true;
    let live = true;
    const active = () => live && mounted.current;
    loadSaved(active).catch(() => { if (active()) setError(tr('Could not load NID profile.', 'এনআইডি প্রোফাইল লোড হয়নি।')); })
      .finally(() => { if (active()) setLoading(false); });
    return () => {
      live = false; mounted.current = false;
      if (savedUrl.current) URL.revokeObjectURL(savedUrl.current);
      savedUrl.current = ''; workerRef.current?.terminate();
    };
  }, [base]);
  // The alert sits below the form; bring it into view when it changes.
  useEffect(() => { if (error) alertRef.current?.scrollIntoView?.({ block:'nearest', behavior:'smooth' }); }, [error]);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const closeCamera = () => setCameraOpen(false);
  function openCamera() { setConfirmed(false); setError(''); setCameraOpen(true); }

  function fileError(err) {
    return err.message === 'format'
      ? tr('Choose a PDF, JPG, PNG, WebP, GIF, BMP, AVIF or HEIC/HEIF file.', 'PDF, JPG, PNG, WebP, GIF, BMP, AVIF বা HEIC/HEIF ফাইল দিন।')
      : err.message === 'empty'
        ? tr('This file is empty or could not be read. Choose another file.', 'ফাইলটি খালি বা পড়া যায়নি। অন্য ফাইল দিন।')
        : err.message === 'size'
          ? tr('Choose a file under 24 MB.', '২৪ MB-এর কম ফাইল দিন।')
          : err.message === 'password'
            ? tr('This PDF is password protected. Upload an unlocked copy.', 'PDF-টি পাসওয়ার্ড দিয়ে সুরক্ষিত। আনলক করা কপি দিন।')
            : tr('This file could not be opened. Choose another file or take a photo.', 'ফাইলটি খোলা যায়নি। অন্য ফাইল দিন অথবা ছবি তুলুন।');
  }

  async function selectFile(image, pageNumber = 1) {
    if (!image) return;
    // A wrong pick keeps the current scan and any edits.
    try { checkNidFile(image); } catch (err) { setError(fileError(err)); return; }
    // The newest file, page or capture wins: a superseded run must never fill
    // the form for a different image, so its late results are dropped.
    const run = ++runRef.current;
    const current = () => mounted.current && runRef.current === run;
    workerRef.current?.terminate(); workerRef.current = null;
    setPdfSource(image === pdfSource?.source ? { ...pdfSource, page:pageNumber } : null);
    setFile(null); setPreview(''); setConfirmed(false); setError(''); setProgress(0); setBusy(true);
    setBirthInput(''); setOcrText(''); setOcrPass(1); setScanning(true);
    setForm({ name:'', date_of_birth:'', nid_number:'' });
    let worker, pages = 0;
    try {
      let prepared, ocrImage;
      try {
        const result = await prepareNidDocument(image, pageNumber);
        prepared = result.image; ocrImage = result.ocrImage; pages = result.pages;
        if (current()) setPdfSource(result.pages ? { source:image, pages:result.pages, page:result.page } : null);
      }
      catch (err) {
        if (current()) setError(fileError(err));
        return;
      }
      if (!current()) return;
      setFile(prepared);
      const { createWorker } = await import('tesseract.js');
      const assets = `${import.meta.env.BASE_URL}ocr`;
      worker = await createWorker('eng', 1, {
        workerPath:`${assets}/worker.min.js`, corePath:`${assets}/tesseract-core-lstm.wasm.js`, langPath:assets,
        logger: (m) => { if (current() && m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); },
      });
      if (!current()) return;
      workerRef.current = worker;
      const result = await recognizeNid(worker, ocrImage, {
        isActive:current,
        onPass:(pass)=>{if (current()) {setOcrPass(pass); setProgress(0);}},
      });
      if (!current()) return;
      const parsed = result.fields; setForm(parsed); setBirthInput(formatNidBirthDate(parsed.date_of_birth)); setOcrText(result.text);
      if (pages > 1 && !Object.values(parsed).some(Boolean)) setError(tr('No NID details were found on this page. Choose the PDF page that contains your NID above.', 'এই পৃষ্ঠায় এনআইডির তথ্য পাওয়া যায়নি। উপরে এনআইডি থাকা PDF পৃষ্ঠাটি বাছুন।'));
      else if (!parsed.name) setError(tr('The full name could not be read reliably. Upload a clearer close-up of the card, or enter the full name exactly as printed. Keep all card edges visible and avoid glare.', 'পুরো নাম নির্ভরযোগ্যভাবে পড়া যায়নি। কার্ডের আরও পরিষ্কার কাছের ছবি দিন, অথবা কার্ডে যেমন আছে ঠিক সেই পুরো নাম লিখুন। চারপাশের প্রান্ত দেখা যায় এমন ছবি দিন এবং আলোর ঝলক এড়িয়ে চলুন।'));
      else if (Object.values(parsed).some((value) => !value)) setError(tr('Some fields could not be read. Review the image and complete them.', 'কিছু তথ্য পড়া যায়নি। ছবি দেখে তথ্য পূরণ করুন।'));
    } catch {
      if (current()) setError(tr('OCR could not read this photo. Retake it or enter the details from the image.', 'OCR ছবিটি পড়তে পারেনি। আবার ছবি তুলুন অথবা ছবি দেখে তথ্য লিখুন।'));
    } finally {
      try { await worker?.terminate(); } catch { /* already stopped for a newer run */ }
      if (workerRef.current === worker) workerRef.current = null;
      if (current()) { setBusy(false); setScanning(false); }
    }
  }
  function saveError(err) {
    const status = err.response?.status;
    if (status === 413 || err.response?.data?.errors?.image) return tr('The image could not be uploaded. Choose or take the photo again, then save.', 'ছবিটি আপলোড হয়নি। আবার ছবি বাছুন বা তুলুন, তারপর সংরক্ষণ করুন।');
    if (status === 429) return tr('Too many attempts. Wait a minute, then save again.', 'অনেকবার চেষ্টা হয়েছে। এক মিনিট পর আবার সংরক্ষণ করুন।');
    if (status === 422) return lang === 'bn' ? 'কিছু তথ্য গ্রহণ করা হয়নি। নাম, জন্মতারিখ ও এনআইডি নম্বর দেখে নিন।' : err.response.data?.message || 'Some details were not accepted. Check the name, date of birth and NID number.';
    return tr('Could not save NID.', 'এনআইডি সংরক্ষণ হয়নি।');
  }
  async function save(event) {
    event.preventDefault(); if (savingRef.current || !canConfirm || !confirmed || !event.currentTarget.checkValidity()) return;
    savingRef.current = true; setBusy(true); setSaving(true); setError('');
    const body = new FormData();
    body.append('image',file); body.append('confirmed',confirmed ? '1' : '0');
    Object.entries(form).forEach(([key,value]) => body.append(key,value));
    try {
      const { data } = await api.post(base,body);
      setSaved(data.data); onSaved?.(data.data);
    } catch (err) {
      // 409: a record is already retained (an earlier save whose reply was lost,
      // or another tab). Show that record read-only instead of an error.
      const existing = err.response?.status === 409 ? await loadSaved().catch(() => null) : null;
      if (existing) onSaved?.(existing);
      else if (mounted.current) setError(saveError(err));
    }
    finally { savingRef.current = false; if (mounted.current) { setBusy(false); setSaving(false); } }
  }
  function updateField(key, value) {
    if (key === 'date_of_birth') { setBirthInput(value); value = parseNidBirthDate(value); }
    if (key === 'nid_number') value = normalizeNidInput(value);
    if (form[key] === value) return;
    setForm(current => ({...current, [key]:value}));
    // An OCR warning no longer applies once the person corrects the details.
    setConfirmed(false); setError('');
  }
  const invalid = {
    date_of_birth: !saved && !!birthInput.trim() && !form.date_of_birth && tr('Use DD/MM/YYYY, for example 20/02/1990.', 'DD/MM/YYYY লিখুন, যেমন 20/02/1990।'),
    nid_number: !saved && !!form.nid_number && !isPlausibleNid(form.nid_number) && tr('Enter the 10, 13 or 17 digit NID number.', '১০, ১৩ বা ১৭ অঙ্কের এনআইডি নম্বর লিখুন।'),
  };
  const fields = saved || form;
  return <section className="space-y-4" aria-label={tr('NID profile','এনআইডি প্রোফাইল')}>
    <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-brand-700" />{tr('NID profile','এনআইডি প্রোফাইল')}</h2>
    {loading ? <p role="status">{tr('Loading…','লোড হচ্ছে…')}</p> : <>
      {!saved && !file && !preview && !busy && !cameraOpen && <NidUploadGuide lang={lang} />}
      {!saved && !cameraOpen && <div className="flex flex-wrap gap-3">
        <button disabled={busy} type="button" onClick={() => upload.current.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 disabled:opacity-50"><Upload className="h-4 w-4" />{tr('Upload NID','এনআইডি আপলোড')}</button>
        <button disabled={busy} type="button" onClick={() => photos.current.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 disabled:opacity-50"><ImagePlus className="h-4 w-4" />{tr('Photo Library','ফটো লাইব্রেরি')}</button>
        <button disabled={busy || cameraOpen} type="button" onClick={openCamera} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 disabled:opacity-50"><Camera className="h-4 w-4" />{tr('Scan with camera','ক্যামেরায় স্ক্যান করুন')}</button>
        <input ref={upload} type="file" accept={NID_FILE_ACCEPT} hidden onChange={(e)=>{selectFile(e.target.files[0]);e.target.value='';}} />
        <input ref={photos} type="file" accept={NID_PHOTO_ACCEPT} aria-label={tr('Choose NID from Photo Library','ফটো লাইব্রেরি থেকে এনআইডি বাছুন')} hidden onChange={(e)=>{selectFile(e.target.files[0]);e.target.value='';}} />
      </div>}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e)=>{selectFile(e.target.files[0]);e.target.value='';}} />
      {!saved && <p className="text-xs text-slate-500">PDF, JPG, PNG, WebP, GIF, BMP, AVIF, HEIC/HEIF · {tr('Up to 24 MB', 'সর্বোচ্চ ২৪ MB')}</p>}
      {pdfSource && !saved && !cameraOpen && <label className="block text-sm">{tr('PDF page containing your NID', 'PDF-এর যে পৃষ্ঠায় এনআইডি আছে')}<select disabled={busy} value={pdfSource.page} onChange={(event)=>selectFile(pdfSource.source,Number(event.target.value))} className="input mt-1 w-full">{Array.from({length:pdfSource.pages},(_,index)=><option key={index+1} value={index+1}>{tr('Page','পৃষ্ঠা')} {index+1} / {pdfSource.pages}</option>)}</select></label>}
      {cameraOpen && <NidCameraScanner lang={lang} onClose={closeCamera} onFallback={()=>{closeCamera();camera.current.click();}} onCapture={(image)=>{closeCamera();selectFile(image);}} />}
      {(preview || scanning) && <NidScanPreview preview={preview} scanning={scanning} saved={!!saved} progress={progress} pass={ocrPass} lang={lang} />}
      {preview && !scanning && <a href={preview} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-brand-700 underline">{tr('Open full-size image','পূর্ণ আকারে ছবি দেখুন')}</a>}
      {file && !saved && <p className="text-xs text-slate-500">{pdfSource ? tr('Only this selected PDF page is saved as an image, not the original PDF. Check the preview before saving.', 'শুধু PDF-এর নির্বাচিত পৃষ্ঠাটি ছবি হিসেবে সংরক্ষিত হবে, মূল PDF নয়। সংরক্ষণের আগে ছবিটি দেখে নিন।') : tr('The full photo is resized for secure storage. This preview is the image that will be saved.', 'নিরাপদে সংরক্ষণের জন্য পুরো ছবির আকার ছোট করা হয়েছে। এই ছবিটিই সংরক্ষিত হবে।')}</p>}
      {file && !scanning && !saved && <p role="status" className="text-sm font-medium text-brand-700">{tr('Review scanned details','স্ক্যান করা তথ্য যাচাই করুন')}</p>}
      {ocrText.trim() && !saved && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-brand-700">{tr('Extracted text','পড়া লেখা')}</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border p-3 font-sans">{ocrText}</pre></details>}
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">{[['name',tr('Name on NID','এনআইডিতে থাকা নাম')],['date_of_birth',tr('Date of birth','জন্মতারিখ')],['nid_number',tr('NID number','এনআইডি নম্বর')]].map(([key,label])=><label key={key} className="block text-sm">{label}<input required readOnly={!!saved} disabled={busy} aria-invalid={!!invalid[key] || undefined} aria-describedby={invalid[key] ? `nid-${key}-hint` : undefined} type="text" inputMode={key==='date_of_birth' ? 'text' : key==='nid_number' ? 'numeric' : undefined} placeholder={key==='date_of_birth' ? 'DD/MM/YYYY' : undefined} value={key==='date_of_birth' ? (saved ? formatNidBirthDate(saved.date_of_birth) : birthInput) : fields[key]} onInput={(e)=>updateField(key,e.currentTarget.value)} onChange={(e)=>updateField(key,e.target.value)} onBlur={(e)=>{if (!saved) updateField(key,e.currentTarget.value);}} className="input mt-1 w-full" />{invalid[key] && <span id={`nid-${key}-hint`} className="mt-1 block text-xs text-red-700">{invalid[key]}</span>}</label>)}</div>
        {!saved ? <>
          <label className={`flex items-start gap-2 text-sm ${!canConfirm ? 'text-slate-500' : ''}`}><input type="checkbox" required checked={confirmed && (canConfirm || saving)} disabled={!canConfirm} onChange={(e)=>setConfirmed(canConfirm && e.target.checked)} className="mt-1 h-4 w-4 shrink-0 disabled:cursor-not-allowed" />{tr('I checked these details against the image. The image will be retained and cannot be replaced or deleted here.','ছবির সঙ্গে তথ্য মিলিয়েছি। ছবিটি সংরক্ষিত থাকবে; এখানে পরিবর্তন বা মুছে ফেলা যাবে না।')}</label>
          <p className="text-xs text-slate-500">{tr('OCR is text extraction, not government identity verification.','OCR শুধু লেখা পড়ে, সরকারি পরিচয় যাচাই করে না।')}</p>
          <button disabled={!canConfirm || !confirmed} aria-busy={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? tr('Saving…','সংরক্ষণ হচ্ছে…') : tr('Save NID profile','এনআইডি প্রোফাইল সংরক্ষণ')}</button>
        </> : <p className="text-sm text-brand-700">{tr('NID image retained securely. Editing and deletion are disabled.','এনআইডির ছবি নিরাপদে সংরক্ষিত। সম্পাদনা ও মুছে ফেলা বন্ধ।')}</p>}
      </form>
    </>}
    {error && <p ref={alertRef} role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
