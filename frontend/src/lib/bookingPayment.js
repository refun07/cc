export function nextBookingPayment(booking) {
  const option = Number(booking?.paid_amount) === 0 && booking?.payment_option === "advance" ? "advance" : "full";
  const due = Number(booking?.due_amount || 0);
  return { option, amount: option === "advance" ? Math.min(Number(booking.advance_amount), due) : due };
}
