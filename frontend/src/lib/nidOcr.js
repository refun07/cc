import { isPlausibleNid } from './nid.js';

const DOB_LABEL = /(?:\bdate\s*of\s*bir?th\b|\bd\.?\s*o\.?\s*b\.?|জন্ম\s*তারিখ)/i;
const NID_LABEL = /(?:\b(?:n\.?\s*i\.?\s*d\.?|i\.?\s*d\.?)\s*(?:number|no\.?|নং)?|\b(?:n[iIl1][oO0]|[iIl1][oO0])\s*(?:number|no\.?)|জাতী(?:য়|য়)\s*পরিচ(?:য়|য়)পত্র\s*(?:নম্বর|নং)|এনআইডি\s*(?:নম্বর|নং)|আইডি\s*(?:নম্বর|নং))(?=\s*(?:[:：.\-]|\d|$))/i;
const NAME_LABEL = /^(?:(?:Name|Narne|Nane)\b|নাম)\s*[:：.\-]?\s*/i;
const OTHER_LABEL = /(?:\b(?:father|mother|address|blood|issue|expiry|name)\b|পিতা|মাতা|ঠিকানা|রক্ত|নাম)/i;
// Small grey card labels are often misread ("pate of Btn", "Dale of Bith").
const DAMAGED_DOB_LABEL = /\b[dp]a[tl]e\s*o[ft]\s*b(?:ir?th|irh|ith|rth|tn|th)\b/gi;
// Card graphics leave stray marks in front of values ("~ MD NAME", "| 20 Feb").
const LEADING_NOISE = /^[\s:：.~*|_'"`‘’“”«»•·,;!(){}[\]-]+/;
// Header and label words that can never be a person's printed Latin name.
const NOT_NAME = /\b(?:GOVERNMENT|PEOPLE'?S?|REPUBLIC|BANGLADESH|NATIONAL|IDENTITY|CARD|NAME|DATE|BIRTH|FATHER|MOTHER|HUSBAND|ADDRESS|BLOOD|GROUP|ISSUE|PLACE|SIGNATURE|NOT|VALID|ONLY)\b/;
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const BANGLA_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'].map(m => m.normalize('NFC'));

function fieldValues(lines, label) {
  const values = [];
  for (let i = 0; i < lines.length; i++) {
    const match = label.exec(lines[i]);
    if (!match) continue;
    let value = lines[i].slice(match.index + match[0].length);
    // OCR sometimes places a value below its label; never cross another field.
    if (!value.replace(/[\s:：.\-]/g, '') && lines[i + 1]) value = lines[i + 1];
    const boundary = value.search(new RegExp(`${DOB_LABEL.source}|${NID_LABEL.source}|${OTHER_LABEL.source}`, 'i'));
    if (boundary >= 0) value = value.slice(0, boundary);
    values.push(value.replace(LEADING_NOISE, '').replace(/\s+[|_]+\s*$/, '').trim());
  }
  return values;
}

// A smart card prints the Latin name as the only all-capitals line between the
// header and the birth date (parents' names are Bengali only). Used only when no
// Name label was read; recognition still needs a second, agreeing reading.
function unlabelledNames(lines) {
  const end = lines.findIndex(line => DOB_LABEL.test(line));
  if (end < 1) return [];
  // Bengali header text read by the English model can look like capitals; when
  // the card header was read, only look below it.
  const header = lines.slice(0, end).findLastIndex(line => /nation|govern|republic|identity|people/i.test(line));
  return [...new Set(lines.slice(header + 1, end)
    .map(line => line.replace(LEADING_NOISE, '').replace(/[\s|_~]+$/, '').replace(/\s+/g, ' ').trim())
    .filter(line => /^[A-Z][A-Z.'’-]*(?: [A-Z][A-Z.'’-]*){1,5}$/.test(line)
      && line.split(' ').every(word => word.replace(/[^A-Z]/g, '').length >= 2)
      && line.replace(/[^A-Z]/g, '').length >= 6 && !NOT_NAME.test(line)))];
}

// The NID label is small and sits next to the signature, so OCR often loses it.
// Accept only the printed number layouts (3-3-4, or one unbroken 10/13/17-digit
// run), never digits inside a longer run, and only on a card front reading.
function unlabelledNid(lines) {
  if (!lines.some(line => DOB_LABEL.test(line))) return '';
  const numbers = lines.filter(line => !line.includes('<')).flatMap(line =>
    [...line.replace(/\s+/g, ' ').matchAll(/(?<![\d-])(?<!\d )(\d{3} ?\d{3} ?\d{4}|\d{17}|\d{13})(?![\d-])(?! \d)/g)].map(match => match[1].replace(/ /g, '')));
  return unique(numbers.filter(isPlausibleNid));
}

function parseDate(value) {
  let parts = value.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})(?:\s|[.,;]|$)/);
  let year, month, day;
  if (parts) [, year, month, day] = parts;
  else {
    parts = value.match(/^(\d{1,2})[\s/.,-]+([\p{L}\p{M}]+|\d{1,2})[\s/.,-]+(\d{4})(?:\s|[.,;]|$)/u);
    if (!parts) return '';
    [, day, month, year] = parts;
    if (!/^\d+$/.test(month)) {
      const english = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
      month = english >= 0 ? english + 1 : BANGLA_MONTHS.indexOf(month) + 1;
    }
  }
  [year, month, day] = [year, month, day].map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || candidate > new Date() || candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function unique(values) {
  const candidates = [...new Set(values.filter(Boolean))];
  return candidates.length === 1 ? candidates[0] : '';
}

export function formatNidBirthDate(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function parseNidBirthDate(input) {
  const value = String(input || '').replace(/[০-৯]/g, n => String('০১২৩৪৫৬৭৮৯'.indexOf(n))).trim();
  // Numeric D/M/Y, or the day-month-year form printed on the card ("20 Feb 1990").
  if (!/^\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{4}$/.test(value) && !/^\d{1,2}[\s/.-]+[a-z]{3,9}\.?[\s/.,-]+\d{4}$/i.test(value)) return '';
  return parseDate(value);
}

export function parseNidText(raw) {
  const text = String(raw || '').normalize('NFC').replace(/[০-৯]/g, n => String('০১২৩৪৫৬৭৮৯'.indexOf(n))).replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/date\s+of\s+birth/gi, 'Date of Birth').replace(DAMAGED_DOB_LABEL, 'Date of Birth').replace(/জন্ম\s+তারিখ/g, 'জন্ম তারিখ');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  // Keep label/value groups together when sparse OCR splits a printed field.
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:N\.?\s*I\.?\s*D\.?|I\.?\s*D\.?)$/i.test(lines[i]) && /^(?:No\.?|Number)\s*[:：.]?$/i.test(lines[i+1] || '')) {
      lines.splice(i,2,`${lines[i]} ${lines[i+1]}`);
    }
    if (!NID_LABEL.test(lines[i])) continue;
    while (/^[\d\s-]+$/.test(lines[i+1] || '')) {
      lines.splice(i,2,`${lines[i]} ${lines[i+1]}`);
    }
  }
  const names = fieldValues(lines, NAME_LABEL).filter(value => /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(value)).map(value => value.replace(/\s+/g,' ').trim());
  // Bangladesh cards print both scripts; prefer the explicitly labelled Latin name.
  const latinNames = names.filter(value => /[a-z]/i.test(value) && !/[\u0980-\u09ff]/.test(value));
  const name = names.length ? unique(latinNames.length ? latinNames : names) : unique(unlabelledNames(lines));
  const date = unique(fieldValues(lines, DOB_LABEL).map(parseDate));
  const labelledNids = fieldValues(lines, NID_LABEL).map(value => {
    // Accept spacing/hyphens, but do not guess OCR-confused letters or truncate digits.
    if (!/^[\d\s-]+[.,;]?$/.test(value)) return '';
    const digits = value.replace(/[\s.,;-]/g, '');
    return isPlausibleNid(digits) ? digits : '';
  }).filter(Boolean);
  // "National ID Card" also looks like a label; only a label with a valid number counts.
  const nid = labelledNids.length ? unique(labelledNids) : unlabelledNid(lines);
  return { name, date_of_birth: date, nid_number: nid };
}
