import { Crosshair, Image, ScanLine } from 'lucide-react';
import { NID_OCR_PASSES } from '../lib/nidRecognition';

export default function NidScanPreview({ preview, scanning, progress, pass, lang }) {
  const tr = (en, bn) => lang === 'bn' ? bn : en;
  const reading = !!preview;
  return <div className={`nid-scan-preview${scanning ? ' is-scanning' : ''}`}>
    <div className="nid-scan-stage" aria-busy={scanning}>
      {preview
        ? <img src={preview} alt={tr('Retained NID image', 'সংরক্ষিত এনআইডির ছবি')} />
        : <div className="nid-scan-document" aria-hidden="true">
          <Image strokeWidth={1.25} />
          <div><span /><span /><span /></div>
        </div>}
      {scanning && <div className="nid-scan-frame" aria-hidden="true">
        <div className="nid-scan-grid" />
        <div className="nid-scan-beam" />
        <div className="nid-scan-axis" />
        <div className="nid-scan-reticle"><Crosshair strokeWidth={1} /></div>
        <div className="nid-scan-ruler" />
        <span /><span /><span /><span />
      </div>}
    </div>
    {scanning && <div className="nid-scan-status">
      <div className="flex min-w-0 items-center gap-2" role="status">
        <ScanLine className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">{reading ? (pass > 1 ? tr('Refining text recognition…', 'লেখা আরও স্পষ্টভাবে পড়া হচ্ছে…') : tr('Recognizing document text…', 'পরিচয়পত্রের লেখা পড়া হচ্ছে…')) : tr('Preparing image…', 'ছবি প্রস্তুত হচ্ছে…')}</p>
        {reading && <span className="shrink-0 text-xs tabular-nums">{tr('Pass', 'পাস')} {pass}/{NID_OCR_PASSES}{progress > 0 ? ` · ${progress}%` : ''}</span>}
      </div>
      <progress max="100" value={reading && progress > 0 ? progress : undefined} aria-label={tr('OCR progress', 'OCR অগ্রগতি')} />
      <div className="nid-scan-steps" aria-hidden="true">
        <span className={!reading ? 'is-current' : 'is-done'}>{tr('Image', 'ছবি')}</span>
        <span className={reading ? 'is-current' : ''}>{tr('Text recognition', 'লেখা শনাক্তকরণ')}</span>
        <span>{tr('Review details', 'তথ্য পর্যালোচনা')}</span>
      </div>
    </div>}
  </div>;
}
