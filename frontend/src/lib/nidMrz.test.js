import test from 'node:test';
import assert from 'node:assert/strict';
import {readNidMrz,reconcileNidMrz} from './nidMrz.js';

const mrz='I<BGD583729164<05<<<<<<<<<<<<<<\n9002203M3211142BGD<<<<<<<<<<<0\nPERSON<<TEST<<<<<<<<<<<<<<<<<<<';
const empty={name:'TEST PERSON',date_of_birth:'',nid_number:''};
test('BD TD1 extended number and birth-date checks are validated without autocorrection',()=>{
  assert.deepEqual(readNidMrz(mrz),[{nid_number:'5837291640',birthCode:'900220'}]);
  for(const text of [mrz.replace('<05','<06'),mrz.replace('9002203','9002204'),mrz.replace('583729164','583729I64'),mrz.replaceAll('BGD','UTO')])assert.deepEqual(readNidMrz(text),[]);
});
test('MRZ corroborates weak labels but requires a printed number and full matching date',()=>{
  const result=reconcileNidMrz([mrz,'Date of Btn 20 Feb 1990\nnoise 583 729 1640'],empty);
  assert.deepEqual(result,{...empty,date_of_birth:'1990-02-20',nid_number:'5837291640'});
  assert.deepEqual(reconcileNidMrz([mrz],empty),empty);
  assert.equal(reconcileNidMrz([mrz,'noise 5837291640'],empty).date_of_birth,'');
  assert.equal(reconcileNidMrz([mrz,'20 Feb 2090\n5837291640'],empty).date_of_birth,'');
});
test('a conflicting labelled number is not replaced by MRZ',()=>{
  assert.equal(reconcileNidMrz([mrz,'NID No: 6847391520\n5837291640'],empty).nid_number,'');
  assert.equal(reconcileNidMrz([mrz,'Date of Btn 21 Feb 1990\n5837291640'],empty).date_of_birth,'');
});
