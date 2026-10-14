const DYNAMIC_PHRASES = [
  [/^(\d+) listed$/, (count) => `তালিকায় ${count} জন`],
  [/^Articles \((\d+)\)$/, (count) => `নিবন্ধ (${count})`],
  [/^Working area: (.+)$/, (area) => `কাজের অঞ্চল: ${area}`],
  [/^Centre: (.+)$/, (centre) => `কেন্দ্র: ${centre}`],
  [/^(\d+) verified venues for weddings, corporate & social events\.$/, (count) => `${count}টি যাচাইকৃত ভেন্যু বিয়ে, কর্পোরেট ও সামাজিক অনুষ্ঠানের জন্য।`],
  [/^(\d+)\+ guests$/, (count) => `${count}+ অতিথি`],
  [/^Dates \((\d+)\)$/, (count) => `তারিখ (${count})`],
  [/^Due later: (৳.+)$/, (amount) => `পরে পরিশোধযোগ্য: ${amount}`],
  [/^Outstanding (৳.+)$/, (amount) => `বকেয়া ${amount}`],
  [/^Up to (৳.+) refundable$/, (amount) => `সর্বোচ্চ ${amount} রিফান্ডযোগ্য`],
  [/^Last payment · (.+) · (.+)$/, (method, transaction) => `সর্বশেষ পেমেন্ট · ${method} · ${transaction}`],
  [/^Paying now \((full|advance|later)\)$/, (option) => `এখন পরিশোধ (${({ full: "সম্পূর্ণ", advance: "অগ্রিম", later: "পরে" })[option]})`],
  [/^Confirm & pay (৳.+)$/, (amount) => `নিশ্চিত করুন ও ${amount} পরিশোধ করুন`],
  [/^Review & pay (৳.+)$/, (amount) => `পর্যালোচনা করুন ও ${amount} পরিশোধ করুন`],
  [/^Pay (৳.+)$/, (amount) => `${amount} পরিশোধ করুন`],
  [/^(\d+) dates?$/, (count) => `${count}টি তারিখ`],
  [/^Venue · (\d+) dates$/, (count) => `ভেন্যু · ${count}টি তারিখ`],
  [/^Hi (.+) 👋$/, (name) => `স্বাগতম ${name} 👋`],
  [/^Paid via (.+)$/, (method) => `পরিশোধের মাধ্যম: ${method}`],
  [/^Booking cancelled: (.+)$/, (reason) => `বুকিং বাতিল হয়েছে: ${reason}`],
  [/^Booking cancelled\.$/, () => "বুকিং বাতিল হয়েছে।"],
  [/^(৳.+) refunded\.$/, (amount) => `${amount} ফেরত দেওয়া হয়েছে।`],
  [/^Up to (\d+) guests$/, (count) => `সর্বোচ্চ ${count} অতিথি`],
  [/^(.+) · morning or evening$/, (floor) => `${floor} · সকাল অথবা সন্ধ্যা`],
  [/^(.+) · entire day$/, (floor) => `${floor} · সারাদিন`],
  [/^Show image (\d+)$/, (number) => `ছবি ${number} দেখুন`],
  [/^View image (\d+) enlarged$/, (number) => `ছবি ${number} বড় করে দেখুন`],
  [/^Choose a date for day (\d+)…$/, (day) => `${day} নম্বর দিনের তারিখ বাছুন…`],
  [/^Remove date (\d+)$/, (day) => `${day} নম্বর দিনের তারিখ সরান`],
  [/^Day (\d+)$/, (day) => `দিন ${day}`],
  [/^Venue \((Full Day|Half Day · Morning|Half Day · Evening)\)$/, (session) => `ভেন্যু (${phrasesForSession[session]})`],
  [/^Open 360 degree virtual tour for (.+)$/, (name) => `${name}-এর ৩৬০ ডিগ্রি ভার্চুয়াল ট্যুর খুলুন`],
];

const phrasesForSession = {
  "Full Day": "পুরো দিন",
  "Half Day · Morning": "অর্ধ দিন · সকাল",
  "Half Day · Evening": "অর্ধ দিন · সন্ধ্যা",
};

export function translateBangla(value, phrases) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  let translated = phrases[trimmed];
  if (translated === undefined) {
    for (const [pattern, render] of DYNAMIC_PHRASES) {
      const match = trimmed.match(pattern);
      if (match) {
        translated = render(...match.slice(1));
        break;
      }
    }
  }
  return translated === undefined ? value : value.replace(trimmed, translated);
}
