import { UserRound } from 'lucide-react';

export default function NidUploadGuide({ lang }) {
  const tr = (en, bn) => lang === 'bn' ? bn : en;
  return <figure className="nid-upload-guide" aria-label={tr('Sample NID image layout', 'এনআইডি ছবির নমুনা')}>
    <div className="nid-guide-card" aria-hidden="true">
      <div className="nid-guide-header">
        <span>{tr('NATIONAL ID', 'জাতীয় পরিচয়পত্র')}</span>
        <span className="nid-guide-tag">{tr('SAMPLE', 'নমুনা')}</span>
      </div>
      <div className="nid-guide-body">
        <div className="nid-guide-portrait"><UserRound strokeWidth={1.25} /></div>
        <div className="nid-guide-fields">
          <div><span>{tr('Name', 'নাম')}</span><strong>{tr('Your name', 'আপনার নাম')}</strong></div>
          <div><span>{tr('Date of birth', 'জন্মতারিখ')}</span><strong>DD / MM / YYYY</strong></div>
          <div><span>{tr('NID number', 'এনআইডি নম্বর')}</span><strong>XXXX XXXX XX</strong></div>
        </div>
      </div>
      <span className="nid-guide-watermark">SAMPLE</span>
    </div>
    <figcaption>{tr('Straight, clear image · All four corners visible', 'সোজা ও স্পষ্ট ছবি · চারটি কোণ দৃশ্যমান')}</figcaption>
  </figure>;
}
