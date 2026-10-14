import test from "node:test";
import assert from "node:assert/strict";
import { isPlausibleNid, isNidProfileComplete, normalizeNidInput } from "./nid.js";

test('NID review requires all three valid fields', () => {
  const valid = {name:'TEST PERSON',date_of_birth:'1990-02-20',nid_number:'5837291640'};
  const check = form => isNidProfileComplete(form, '2026-10-13');
  assert.equal(check(valid), true);
  for (const field of Object.keys(valid)) assert.equal(check({...valid,[field]:''}),false);
  assert.equal(check({...valid,name:'   '}),false);
  assert.equal(check({...valid,name:'a'.repeat(256)}),false);
  for (const date of ['1990-02-31','1900-01-01','2026-10-13','2027-01-01','20/02/1990']) assert.equal(check({...valid,date_of_birth:date}),false);
  assert.equal(check({...valid,nid_number:'123'}),false);
  assert.equal(check({...valid,nid_number:'583729164O'}),false);
});

test("NID input rejects invalid lengths and obvious fake sequences", () => {
  for (const value of ["12345678910", "1234567890", "1111111111", "9876543210", "1234567890123", "12345678901234567"]) {
    assert.equal(isPlausibleNid(value), false, value);
  }
  assert.equal(isPlausibleNid("3216549870"), true);
});

test("typed NID numbers keep only digits a person would separate by spaces or dashes", () => {
  assert.equal(normalizeNidInput("583 729 1640"), "5837291640");
  assert.equal(normalizeNidInput("৫৮৩-৭২৯-১৬৪০"), "5837291640");
  assert.equal(normalizeNidInput("583729I640"), "583729I640");
});
