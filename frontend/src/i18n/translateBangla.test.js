import { test } from "node:test";
import { strict as assert } from "node:assert";
import { translateBangla } from "./translateBangla.js";
import { PHRASES_BN } from "./phrases.js";

const phrases = { Search: "অনুসন্ধান", "Pay later": "পরে পরিশোধ করুন" };

test("admin settlement totals and receipt counts have Bengali labels", () => {
  for (const label of ["Settlement items", "Gross reconciled", "Platform fees", "Tax withheld", "Awaiting payout", "Paid to centres", "approved", "held", "Payment period", "Fees + tax", "Net payout", "No settlements found"]) {
    assert.notEqual(translateBangla(label, PHRASES_BN), label);
  }
});

test("QA report and feedback labels have Bengali translations", () => {
  for (const label of ["Total GMV", "Avg booking value", "Refunds", "Bookings CSV", "Payments CSV", "Feedback", "Please sign in from the header before sending feedback.", "payment_pending", "draft", "paid", "pending", "failed"]) {
    assert.notEqual(translateBangla(label, PHRASES_BN), label);
  }
});

test("translates exact phrases while preserving surrounding whitespace", () => {
  assert.equal(translateBangla(" Search ", phrases), " অনুসন্ধান ");
  assert.equal(translateBangla("Pay later", phrases), "পরে পরিশোধ করুন");
});

test("translates known dynamic UI strings without changing amounts or names", () => {
  assert.equal(translateBangla("Due later: ৳1,500", phrases), "পরে পরিশোধযোগ্য: ৳1,500");
  assert.equal(translateBangla("Hi Rahim 👋", phrases), "স্বাগতম Rahim 👋");
  assert.equal(translateBangla("Paid via ekPay", phrases), "পরিশোধের মাধ্যম: ekPay");
  assert.equal(translateBangla("Choose a date for day 2…", phrases), "2 নম্বর দিনের তারিখ বাছুন…");
  assert.equal(translateBangla("Venue (Full Day)", phrases), "ভেন্যু (পুরো দিন)");
});

test("does not translate user content without a known phrase", () => {
  assert.equal(translateBangla("Grand Hall", phrases), "Grand Hall");
  assert.equal(translateBangla("", phrases), "");
});

test("checkout account notice gives Bengali sign-in and registration instructions", () => {
  assert.equal(
    translateBangla("Create an account with your mobile number to confirm a booking.", PHRASES_BN),
    "একাউন্ট করে অবশ্যই লগইন করতে হবে আর অ্যাকাউন্ট না থাকলে নতুন একাউন্ট রেজিস্টার করে নিবেন"
  );
});

test("checkout gateway status is translated without inventing payment methods", () => {
  assert.equal(translateBangla("Payment gateway", PHRASES_BN), "পেমেন্ট গেটওয়ে");
  assert.equal(translateBangla("Sandbox setup pending", PHRASES_BN), "স্যান্ডবক্স সেটআপ বাকি");
  assert.equal(
    translateBangla("Online payment is not available yet. ekPay will show the enabled sandbox payment methods once the gateway is connected.", PHRASES_BN),
    "অনলাইন পেমেন্ট এখনো চালু হয়নি। গেটওয়ে সংযুক্ত হলে ekPay-তে চালু থাকা স্যান্ডবক্স পেমেন্ট পদ্ধতিগুলো দেখা যাবে।"
  );
});

test("updated booking steps have complete Bengali copy", () => {
  const steps = [
    "Browse centres",
    "Search by area and capacity; compare reviews and decorator contacts.",
    "Sign in by phone",
    "Register with an SMS code or sign in using your mobile number.",
    "Choose your booking",
    "Pick date, floor and session; add guests and organiser details. NID is needed only on your first booking.",
    "Review & reserve",
    "Check charges, choose pay later or online payment when available, then track your booking.",
  ];

  for (const step of steps) {
    assert.notEqual(translateBangla(step, PHRASES_BN), step);
  }
});

test("checkout event contact guidance is clear in Bengali", () => {
  assert.equal(
    translateBangla("Person responsible for the event (optional)", PHRASES_BN),
    "অনুষ্ঠানের দায়িত্বে থাকা ব্যক্তির তথ্য (ঐচ্ছিক)"
  );
  assert.notEqual(
    translateBangla("Who should the centre contact about event arrangements? Add another person's details, use your own, or leave blank if undecided.", PHRASES_BN),
    "Who should the centre contact about event arrangements? Add another person's details, use your own, or leave blank if undecided."
  );
});

test("new guide, decorator and footer controls have Bengali labels", () => {
  for (const label of [
    "Contact options for customers booking your centre.",
    "No decorators listed for this centre.",
    "Manage the public How it works articles and videos.",
    "Title (Bangla)",
    "Link text (English)",
    "Payment channels listed by ekPay",
  ]) {
    assert.notEqual(translateBangla(label, PHRASES_BN), label);
  }
  assert.equal(translateBangla("3 listed", PHRASES_BN), "তালিকায় 3 জন");
  assert.equal(translateBangla("Articles (4)", PHRASES_BN), "নিবন্ধ (4)");
  assert.equal(translateBangla("Working area: zone-1", PHRASES_BN), "কাজের অঞ্চল: zone-1");
});

test("homepage booking and payment copy stays accurate in Bengali", () => {
  assert.equal(
    translateBangla("Find the right venue, review the details and confirm your booking.", PHRASES_BN),
    "উপযুক্ত ভেন্যু খুঁজে বিস্তারিত দেখে বুকিং নিশ্চিত করুন।"
  );
  assert.equal(
    translateBangla("Available online payment methods are shown on the ekPay checkout page.", PHRASES_BN),
    "অনলাইনে কোন পেমেন্ট মাধ্যম পাওয়া যাবে, তা ekPay-এর পেমেন্ট পেজে দেখা যাবে।"
  );
});
