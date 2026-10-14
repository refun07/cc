import test from "node:test";
import assert from "node:assert/strict";
import { canDownloadRefundApplication, refundApplicationHtml } from "./refundApplication.js";

const booking = {
  booking_no: "ICCMS-123",
  centre: { name: "Basabo Community Center" },
  customer_name: "Applicant",
  customer_phone: "01700000000",
  event_date: "2026-10-20",
  paid_amount: 1000,
  refunded_amount: 0,
};

test("refund application is available only with an outstanding paid amount", () => {
  assert.equal(canDownloadRefundApplication(booking), true);
  assert.equal(canDownloadRefundApplication({ ...booking, refundable_amount: 0, refunded_amount: 1000 }), false);
  assert.equal(canDownloadRefundApplication({ ...booking, paid_amount: 400, refunded_amount: 600 }), true);
  assert.equal(canDownloadRefundApplication({ ...booking, paid_amount: 0 }), false);
});

test("downloadable application contains booking details and safely escapes customer data", () => {
  const html = refundApplicationHtml({ ...booking, customer_name: '<img src=x onerror="alert(1)">' });
  assert.match(html, /ICCMS-123/);
  assert.match(html, /Basabo Community Center/);
  assert.match(html, /name="reason"/);
  assert.match(html, /name="refund_details"/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});
