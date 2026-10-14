import { parseNidText } from './nidOcr.js';

const NAME_LABEL = /^(?:name|narne|nane)\b\s*[:：.-]?\s*/i;
const BOUNDARY = /(?:father|mother|date|birth|blood|address|national|government|identity|পিতা|মাতা|জন্ম|ঠিকানা)/i;

export function nidOcrLines(data) {
  return (data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []));
}

export function parseNidNameCrop(text) {
  const labelled=parseNidText(text).name;
  if (labelled) return labelled;
  const lines=String(text || '').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  // This fallback is only for a crop anchored to a Name label already observed
  // in the full image. OCR may omit the small label in an otherwise clear crop.
  if (lines.length===1) {
    if (BOUNDARY.test(lines[0]) || NAME_LABEL.test(lines[0])) return '';
    return /^[a-z][a-z\s.'’-]*$/i.test(lines[0]) ? lines[0].replace(/\s+/g,' ') : '';
  }
  // A tight crop can still clip a neighbouring field. Accept one clear capitals
  // name line only when every other line is a short scrap, not another name.
  const names=lines.map(line=>line.replace(/[\s|_~]+$/,'').replace(/\s+/g,' ')).filter(line=>/^[A-Z][A-Z.'’-]*(?: [A-Z][A-Z.'’-]*)+$/.test(line) && !BOUNDARY.test(line));
  const scraps=lines.filter(line=>!names.includes(line.replace(/[\s|_~]+$/,'').replace(/\s+/g,' ')));
  return names.length===1 && scraps.every(line=>line.replace(/[^a-z]/gi,'').length<=4 && !NAME_LABEL.test(line)) ? names[0] : '';
}

export function findNidTextColumn(data) {
  if (Math.abs(data.rotateRadians || 0)>.01 && !data.imageGrey) return null;
  const rows=nidOcrLines(data).filter(line=>/date\s*of\s*(?:bir?th|btn)\b/i.test(line.text));
  if (rows.length!==1) return null;
  const word=(rows[0].words || []).find(word=>/^date$/i.test(word.text));
  if (!word?.bbox || word.confidence<50) return null;
  const b=word.bbox,h=b.y1-b.y0;
  return {x0:b.x0-h*.8,y0:0,x1:Infinity,y1:Infinity};
}

export function nidNameEvidence(data, name) {
  if (!name) return 0;
  const normalized = name.replace(/\s+/g, ' ').trim().toUpperCase();
  const lines = nidOcrLines(data);
  const match = lines.find(line => (parseNidText(line.text).name || line.text.replace(NAME_LABEL, '')).replace(/\s+[|_]+\s*$/, '').replace(/\s+/g, ' ').trim().toUpperCase() === normalized);
  if (!match) return 0;
  const tokens = new Set(normalized.split(/\s+/).map(word => word.replace(/[.'’-]/g, '')));
  const words = (match.words || []).filter(word => tokens.has(word.text.toUpperCase().replace(/[.'’-]/g, '')));
  if (!words.length) return match.confidence;
  if (words.some(word=>word.confidence<40)) return 0;
  const substantive=words.filter(word=>!/^\s*(?:md|dr)\.?\s*$/i.test(word.text));
  return Math.min(...(substantive.length ? substantive : words).map(word=>word.confidence));
}

// Only use a region anchored to the printed English Name label, never a fixed
// card template that could accidentally read a parent's name on another layout.
export function findNidNameRegion(data) {
  // Rotated bounding boxes are safe only with Tesseract's matching image output.
  if (Math.abs(data.rotateRadians || 0) > 0.01 && !data.imageGrey) return null;
  const lines = nidOcrLines(data).filter(line => line.bbox).sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const words=lines.flatMap(line=>line.words || []).filter(word=>word.bbox);
  if (words.length) {
    const labels=words.filter(word=>/^(?:name|narne|nane)[:：.]?$/i.test(word.text.trim()));
    if (labels.length!==1) return null;
    const b=labels[0].bbox, h=Math.max(8,b.y1-b.y0);
    const inline=words.filter(word=>word.bbox.x0>=b.x1 && word.bbox.y0<b.y1 && word.bbox.y1>b.y0 && /^[a-z][a-z.'’-]*$/i.test(word.text));
    if (inline.length && !inline.some(word=>BOUNDARY.test(word.text))) return {x0:b.x0-h*.4,y0:Math.min(b.y0,...inline.map(word=>word.bbox.y0))-h*.3,x1:Math.max(...inline.map(word=>word.bbox.x1))+h*.8,y1:Math.max(b.y1,...inline.map(word=>word.bbox.y1))+h*.35};
    // Portrait/edge noise can make a whole line's box overlap the label. Word
    // boxes keep the crop anchored to the printed field, not that noisy line.
    const below=words.filter(word=>word.bbox.x0>=b.x0-h*.4 && word.bbox.y0>=b.y1-h*.15 && word.bbox.y0<b.y1+h*4);
    const first=below.filter(word=>word.bbox.x0<b.x0+h*2 && word.confidence>=40 && /^[a-z][a-z.'’-]*$/i.test(word.text) && !BOUNDARY.test(word.text)).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];
    if (!first) return null;
    const row=below.filter(word=>word.bbox.y0<first.bbox.y1 && word.bbox.y1>first.bbox.y0 && /^[a-z][a-z.'’-]*$/i.test(word.text));
    if (row.some(word=>BOUNDARY.test(word.text))) return null;
    return {x0:b.x0-h*.4,y0:b.y0-h*.3,x1:Math.max(b.x1,...row.map(word=>word.bbox.x1))+h*.8,y1:Math.max(...row.map(word=>word.bbox.y1))+h*.35};
  }
  const labels = lines.filter(line => NAME_LABEL.test(line.text.trim()));
  if (labels.length !== 1) return null;
  const label = labels[0], b = label.bbox, h = Math.max(8, b.y1 - b.y0);
  const next = lines.filter(line => line !== label && line.bbox.y0 >= b.y1 - h * .2 && line.bbox.y0 < b.y1 + h * 4 && line.bbox.x1 > b.x0);
  const boundary = next.find(line => BOUNDARY.test(line.text));
  const value = label.text.trim().replace(NAME_LABEL, '');
  const valueLines = value ? [label] : next.filter(line => !BOUNDARY.test(line.text) && (!boundary || line.bbox.y0 < boundary.bbox.y0)).slice(0, 2);
  if (!valueLines.length) return null;
  const last = Math.max(...valueLines.map(line => line.bbox.y1));
  const bottom = Math.min(last + h * .45, boundary ? boundary.bbox.y0 - 2 : Infinity);
  return { x0: b.x0 - h * .7, y0: b.y0 - h * .4, x1: Math.max(b.x1, ...valueLines.map(line => line.bbox.x1)) + h * 3, y1: bottom };
}

// When the small Name label was not read, crop the one printed line that already
// reads as the name, so a second independent reading can confirm or reject it.
export function findNidNameLine(data, name) {
  if (!name || (Math.abs(data.rotateRadians || 0) > 0.01 && !data.imageGrey)) return null;
  const target = name.replace(/[^a-z]/gi, '').toUpperCase();
  const matches = nidOcrLines(data).filter(line => line.bbox && line.text.replace(/[^a-z]/gi, '').toUpperCase() === target);
  if (matches.length !== 1) return null;
  // Median word boxes avoid card lines and portrait edges that stretch a line's box.
  const words = (matches[0].words || []).filter(word => word.bbox && /[a-z]/i.test(word.text));
  if (!words.length) return null;
  const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const h = Math.max(8, median(words.map(word => word.bbox.y1 - word.bbox.y0)));
  const cy = median(words.map(word => (word.bbox.y0 + word.bbox.y1) / 2));
  return { x0:Math.min(...words.map(word => word.bbox.x0)) - h * .6, y0:cy - h, x1:Math.max(...words.map(word => word.bbox.x1)) + h * .8, y1:cy + h, textHeight:h };
}

export function chooseNidName(readings) {
  const candidates = readings.filter(reading => reading.name && reading.nameConfidence >= 60 && !hasPossibleNameFragment(reading.name));
  const latin = candidates.filter(reading => /^[a-z\s.'’-]+$/i.test(reading.name));
  const select = entries => {
    const groups = new Map();
    for (const reading of entries) {
      const name = reading.name.replace(/\s+/g, ' ').trim().toUpperCase();
      const key=name.replace(/\./g,'');
      const group = groups.get(key) || { count: 0, total: 0, name };
      group.count++; group.total += reading.nameConfidence; groups.set(key, group);
    }
    const ranked = [...groups].sort((a, b) => b[1].count - a[1].count);
    if (!ranked.length) return '';
    const [, votes] = ranked[0];
    // Two independent segmentation/language readings must agree. Never complete
    // a partial name from a dictionary, similar spelling, or account information.
    return votes.count >= 2 && votes.total / votes.count >= 75 && (!ranked[1] || votes.count > ranked[1][1].count) ? votes.name : '';
  };
  // One damaged Latin reading must not hide two good Bengali-name readings.
  return select(latin) || select(candidates.filter(reading => !latin.includes(reading)));
}

export function hasPossibleNameFragment(name) {
  const first = name.trim().split(/\s+/)[0].replace(/\./g, '').toUpperCase();
  // Short leading Latin fragments commonly come from a missed first word.
  // Initial-based names can still be entered explicitly during image review.
  return /^[A-Z]{1,2}$/.test(first) && !['MD', 'DR'].includes(first);
}

