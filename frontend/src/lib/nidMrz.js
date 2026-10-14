import {parse} from 'mrz';
import {isPlausibleNid} from './nid.js';
import {parseNidText} from './nidOcr.js';

export function readNidMrz(text) {
  const lines=String(text || '').split(/\r?\n/).map(line=>line.replace(/\s+/g,'').toUpperCase()).filter(Boolean);
  const results=[];
  for(let i=0;i<lines.length-1;i++) {
    const first=lines[i],second=lines[i+1];
    // Only Bangladesh TD1 numeric document data; no letter-to-digit repair.
    if(!/^I<BGD\d{9}<\d{2,9}</.test(first) || !/^\d{7}[MF<]\d{7}BGD/.test(second))continue;
    try {
      // Missing trailing fillers do not participate in these two field checks.
      // Names/composite validity are deliberately not inferred from this parse.
      const result=parse([first.slice(0,30).padEnd(30,'<'),second.slice(0,30).padEnd(30,'<'),'<'.repeat(30)],{autocorrect:false});
      const valid=field=>result.details.some(detail=>detail.field===field && detail.valid);
      if(result.fields.issuingState!=='BGD' || !valid('documentNumberCheckDigit') || !valid('birthDateCheckDigit') || !valid('birthDate') || !isPlausibleNid(result.documentNumber))continue;
      results.push({nid_number:result.documentNumber,birthCode:result.fields.birthDate});
    } catch { /* Unsupported/damaged MRZ stays unfilled. */ }
  }
  return results;
}

export function reconcileNidMrz(texts,fields) {
  const codes=texts.flatMap(readNidMrz);
  const identities=[...new Set(codes.map(code=>`${code.nid_number}/${code.birthCode}`))];
  if(identities.length>1)return {name:'',date_of_birth:'',nid_number:''};
  if(identities.length!==1)return fields;
  const code=codes[0];
  if(texts.flatMap(text=>[text,...text.split(/\r?\n/)]).some(text=>{const number=parseNidText(text).nid_number;return number && number!==code.nid_number;}))return {...fields,nid_number:''};
  const printedNumbers=texts.flatMap(text=>text.split(/\r?\n/).filter(line=>!line.includes('<')).flatMap(line=>[...line.matchAll(/\d[\d\s-]{8,}\d/g)].map(match=>match[0].replace(/[\s-]/g,''))));
  // Do not combine a front from one card with a different card's reverse.
  if(!printedNumbers.includes(code.nid_number))return fields;
  // Require a full visual date agreeing with the checked YYMMDD. This avoids
  // guessing a century or accepting a misread date just because it is plausible.
  const dates=texts.flatMap(text=>{
    const labelled=text.split(/\r?\n/).map(line=>parseNidText(line.replace(/date\s*of\s*(?:btn|b[il]th)\b/i,'Date of Birth')).date_of_birth);
    const printed=[...text.matchAll(/\b\d{1,2}[\s/.,-]+(?:[A-Za-z]{3,9}|\d{1,2})[\s/.,-]+\d{4}\b/g)].map(match=>parseNidText(`DOB: ${match[0]}`).date_of_birth);
    return [...labelled,...printed];
  }).filter(date=>date && date.slice(2).replace(/-/g,'')===code.birthCode);
  const date=[...new Set(dates)];
  return {...fields,nid_number:code.nid_number,date_of_birth:date.length===1 ? date[0] : fields.date_of_birth};
}
