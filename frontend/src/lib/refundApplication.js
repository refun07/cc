const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function canDownloadRefundApplication(booking) {
  return Number(booking?.refundable_amount ?? booking?.paid_amount ?? 0) > 0;
}

export function refundApplicationHtml(booking) {
  if (!canDownloadRefundApplication(booking)) throw new Error("No refundable payment on this booking.");

  const cell = (label, value) => `<div class="item"><small>${label}</small><strong>${escapeHtml(value || "—")}</strong></div>`;
  const field = (label, name, multiline = false) => `<label>${label}${multiline
    ? `<textarea name="${name}" rows="3"></textarea>`
    : `<input name="${name}" type="text">`}</label>`;

  return `<!doctype html>
<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Refund application - ${escapeHtml(booking.booking_no)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#f5f7f8;color:#162033;font:16px/1.5 system-ui,"Noto Sans Bengali","Hind Siliguri",sans-serif}
  .sheet{max-width:820px;margin:24px auto;padding:36px 42px;background:white;border:1px solid #d8dfe5}
  header{text-align:center;border-bottom:2px solid #007e61;padding-bottom:14px}header h1{font-size:24px;margin:0}header p{margin:4px 0;color:#566579}
  h2{font-size:18px;margin:22px 0 10px}p{margin:10px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px}
  .item{border-bottom:1px solid #d8dfe5;padding:6px 0;min-width:0}.item small{display:block;color:#566579}.item strong{font-size:15px;overflow-wrap:anywhere}
  label{display:block;font-weight:600;margin:12px 0 4px}input,textarea{display:block;width:100%;padding:9px;border:1px solid #9faab5;border-radius:2px;font:inherit;color:inherit;background:white}
  textarea{resize:vertical}.note{font-size:13px;color:#566579}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}.signature{border-top:1px solid #243047;padding-top:7px}
  .actions{max-width:820px;margin:0 auto 20px;display:flex;gap:8px}.actions button{border:0;border-radius:4px;background:#008b6b;color:white;padding:10px 16px;font:inherit;cursor:pointer}
  @media(max-width:620px){.sheet{margin:0;padding:20px}.grid{grid-template-columns:1fr}.actions{padding:12px}}
  @media print{body{background:white}.sheet{margin:0;max-width:none;border:0;padding:0}.actions{display:none}input,textarea{border:0;border-bottom:1px solid #555;border-radius:0;min-height:38px}textarea{min-height:75px}@page{size:A4;margin:18mm}}
</style></head><body>
<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<main class="sheet">
  <header><h1>ফেরতের আবেদনপত্র / Refund Application</h1><p>ICCMS · Dhaka South City Corporation</p></header>
  <p>বরাবর, সংশ্লিষ্ট কর্তৃপক্ষ<br>বিষয়: বুকিংয়ের পরিশোধিত অর্থ ফেরতের আবেদন।</p>
  <h2>বুকিংয়ের তথ্য / Booking details</h2>
  <div class="grid">
    ${cell("বুকিং নম্বর / Booking no.", booking.booking_no)}
    ${cell("সেন্টার / Centre", booking.centre?.name)}
    ${cell("অনুষ্ঠানের তারিখ / Event date", booking.event_date)}
    ${cell("ফ্লোর / Floor", booking.floor_name)}
    ${cell("আবেদনকারী / Customer", booking.customer_name)}
    ${cell("ফোন / Phone", booking.customer_phone)}
    ${cell("পরিশোধিত / Paid (BDT)", booking.paid_amount)}
    ${cell("ইতিমধ্যে ফেরত / Already refunded (BDT)", booking.refunded_amount)}
  </div>
  <h2>আবেদনকারীর পূরণীয় / To be completed by applicant</h2>
  ${field("ফেরত চাওয়ার কারণ / Reason for refund", "reason", true)}
  <div class="grid">${field("আবেদিত টাকার পরিমাণ (BDT) / Amount requested", "amount")}${field("আবেদনের তারিখ / Application date", "application_date")}</div>
  ${field("টাকা ফেরত পাওয়ার মাধ্যম ও হিসাবের তথ্য / Refund method and account details", "refund_details", true)}
  <p class="note">এই ফর্মটি পূরণ ও স্বাক্ষর করে সংশ্লিষ্ট অফিসে হাতে জমা দিন। ফর্ম ডাউনলোড করলে অনলাইনে আবেদন জমা হয় না। ফেরতের অনুমোদন নীতিমালা ও কর্তৃপক্ষের যাচাই সাপেক্ষে।</p>
  <div class="signatures"><div class="signature">আবেদনকারীর স্বাক্ষর / Applicant signature</div><div class="signature">অফিস গ্রহণ / Office receipt</div></div>
</main></body></html>`;
}

export function downloadRefundApplication(booking) {
  const blob = new Blob([refundApplicationHtml(booking)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `refund-application-${String(booking.booking_no).replace(/[^a-zA-Z0-9-]/g, "-")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
