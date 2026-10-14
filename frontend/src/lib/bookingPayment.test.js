import test from "node:test";
import assert from "node:assert/strict";
import { nextBookingPayment } from "./bookingPayment.js";

test("unpaid advance booking retries the advance, not the full balance", () => {
  assert.deepEqual(nextBookingPayment({ paid_amount: "0.00", due_amount: 1000, advance_amount: 300, payment_option: "advance" }), { option: "advance", amount: 300 });
});
test("verified advance is followed by remaining balance", () => {
  assert.deepEqual(nextBookingPayment({ paid_amount: 300, due_amount: 700, advance_amount: 300, payment_option: "advance" }), { option: "full", amount: 700 });
});
test("full payment and advance caps match backend amounts", () => {
  assert.deepEqual(nextBookingPayment({ paid_amount: 0, due_amount: 1000, payment_option: "full" }), { option: "full", amount: 1000 });
  assert.deepEqual(nextBookingPayment({ paid_amount: 0, due_amount: 200, advance_amount: 300, payment_option: "advance" }), { option: "advance", amount: 200 });
});
