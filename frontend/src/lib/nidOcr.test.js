import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNidText, parseNidBirthDate, formatNidBirthDate } from './nidOcr.js';

test('D/M/Y input is unambiguous, strict and normalized for storage', () => {
  assert.equal(parseNidBirthDate('2/3/1990'),'1990-03-02');
  assert.equal(parseNidBirthDate('২০/০২/১৯৯০'),'1990-02-20');
  assert.equal(formatNidBirthDate('1990-03-02'),'02/03/1990');
  for (const invalid of ['31/02/1990','02/20/1990','2/3/90','20/02/1990 extra','']) assert.equal(parseNidBirthDate(invalid),'');
  assert.equal(parseNidText('Date of\nBirth: 2/3/1990').date_of_birth,'1990-03-02');
});

test('reads labeled English name, birth date and spaced NID',()=>{
  assert.deepEqual(parseNidText('Name: TEST PERSON\nFather: SOMEONE\nDate of Birth: 20 Feb 1990\nNID No: 583 729 1640'),{name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'});
});
test('normalizes Bengali digits and does not guess invalid dates or numbers',()=>{
  assert.equal(parseNidText('NID No: ৫৮৩৭২৯১৬৪০').nid_number,'5837291640');
  assert.equal(parseNidText('Date of Birth: 31 Feb 1990').date_of_birth,'');
  assert.equal(parseNidText('NID No: 12345678910').nid_number,'');
  assert.equal(parseNidText('Father Name: SOMEONE').name,'');
});

test('reads smart-card labels, inline fields and punctuation', () => {
  assert.equal(parseNidText('Name: NID OCR TEST PERSON').name,'NID OCR TEST PERSON');
  const result = parseNidText('Name: TEST PERSON\nDate of Birth : 20 February, 1990  ID NO.: 583-729-1640');
  assert.deepEqual(result, {name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'});
  assert.equal(parseNidText('ID NO.\n583 729 1640').nid_number,'5837291640');
  assert.equal(parseNidText('D.O.B.: 1990-02-20').date_of_birth,'1990-02-20');
});

test('reads Bengali date and NID label variants', () => {
  assert.equal(parseNidText('জন্মতারিখ: ২০ ফেব্রুয়ারি ১৯৯০').date_of_birth,'1990-02-20');
  assert.equal(parseNidText('জন্ম তারিখ :\n২০/০২/১৯৯০').date_of_birth,'1990-02-20');
  assert.equal(parseNidText('জাতীয় পরিচয়পত্র নম্বর: ৫৮৩৭২৯১৬৪০').nid_number,'5837291640');
  assert.equal(parseNidText('এনআইডি নং: ৫৮৩৭২৯১৬৪০').nid_number,'5837291640');
});

test('does not consume another field, guess letters, or choose ambiguous identities', () => {
  assert.equal(parseNidText('Name:\nDate of Birth: 20 Feb 1990').name,'');
  assert.equal(parseNidText('ID NO: 583729I640').nid_number,'');
  assert.equal(parseNidText('ID NO: 5837291640\nID NO: 6847391520').nid_number,'');
  assert.equal(parseNidText('DOB: 20 Feb 1990\nDOB: 21 Feb 1990').date_of_birth,'');
  assert.equal(parseNidText('DOB: 20 Feb 2990').date_of_birth,'');
});

test('reads bilingual names and wrapped label/number groups without picking a parent name', () => {
  const result=parseNidText('নাম: পরীক্ষা ব্যক্তি\nName: TEST PERSON\nFather: SOMEONE ELSE\nDate of Birth: 20/02/1990\nID\nNO.\n583\n729\n1640');
  assert.deepEqual(result,{name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'});
  assert.equal(parseNidText('Name: TEST PERSON\nName: OTHER PERSON').name,'');
  assert.equal(parseNidText('Name: TEST PERSON 12345').name,'');
  assert.equal(parseNidText('ID NO: 5837291640\n6847391520').nid_number,'');
});
test('recognizes limited damaged labels without repairing identifier digits',()=>{
  assert.equal(parseNidText('Date of Bith 20 Feb 1990').date_of_birth,'1990-02-20');
  assert.equal(parseNidText('signature io No\n583 729 1640').nid_number,'5837291640');
  assert.equal(parseNidText('NiO No\n5837291640').nid_number,'5837291640');
  assert.equal(parseNidText('NiO No\n583729I640').nid_number,'');
  assert.equal(parseNidText('Name\nTEST PERSON _').name,'TEST PERSON');
});
