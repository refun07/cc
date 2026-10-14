import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import CentreDetail from "../src/pages/CentreDetail";
import BookingSuccess from "../src/pages/BookingSuccess";
import Checkout from "../src/pages/Checkout";
import FlexibleBookingModal from "../src/components/FlexibleBookingModal";
import AvailabilityCalendarPicker from "../src/components/AvailabilityCalendarPicker";
import "../src/index.css";

function CalendarFixture() {
  const [floor, setFloor] = React.useState(1);
  return <><button onClick={() => setFloor(2)}>Second floor</button><AvailabilityCalendarPicker slug="test-centre" floorId={floor} value="2026-10-20" sessionType="full_day" onSelect={() => {}} /></>;
}

createRoot(document.getElementById("root")).render(<BrowserRouter><Routes>
  <Route path="/calendar" element={<CalendarFixture />} />
  <Route path="/flexible" element={<FlexibleBookingModal open mode="owner" onClose={() => {}} />} />
  <Route path="/centres/:slug/book" element={<CentreDetail />} />
  <Route path="/booking/:bookingNo" element={<BookingSuccess />} />
  <Route path="/checkout" element={<Checkout />} />
</Routes></BrowserRouter>);
