// Run with PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node --test tests/booking-flow.browser.mjs
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
let server, browser, origin;
const centre = { id: 1, slug: "test-centre", name: "Test Centre", area: "Dhaka", capacity: 500, floors: [], decorators: [], facilities: [], images: [], full_day_price: 1000, half_day_price: 500, starting_price: 500 };
const quote = { venue_amount: 1000, service_charge: 50, vat_amount: 78.75, total_amount: 1128.75, advance_amount: 338.63, advance_rate: 30, commission_rate: 5 };
const booking = { booking_no: "ICCMS-TEST", centre, customer_name: "Test Customer", customer_phone: "01700000000", event_date: "2026-10-20", session_type: "full_day", guest_count: 100, status: "payment_pending", food_items: [], booking_dates: [], ...quote, paid_amount: 0, due_amount: 1128.75, payment_option: "advance" };
const user = { id: 1, name: "Test Customer", phone: "01700000000", nid_saved: true };
const json = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check) => { for (let i = 0; i < 100; i++) { if (await check()) return; await pause(50); } throw new Error("Condition timed out"); };

before(async () => {
  server = await createServer({ configFile: false, plugins: [react(), {
    name: "booking-test-fixture",
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (!req.headers.accept?.includes("text/html")) return next();
        vite.transformIndexHtml(req.url, '<html><body><div id="root"></div><script type="module" src="/tests/booking-flow.fixture.jsx"></script></body></html>')
          .then((html) => { res.setHeader("Content-Type", "text/html"); res.end(html); });
      });
    },
  }], server: { host: "127.0.0.1", port: 5187 } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  await mkdir("/tmp/cc-booking-qa-screenshots", { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(handler, { width = 390, draft } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: "Asia/Dhaka" });
  await context.addInitScript(({ user, draft }) => {
    localStorage.setItem("dscc-auth", JSON.stringify({ state: { user, token: "test-only" }, version: 0 }));
    if (draft) localStorage.setItem("dscc-booking-draft", JSON.stringify({ state: { draft }, version: 0 }));
  }, { user, draft });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00+06:00"));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (await handler?.(route, url)) return;
    if (url.pathname === "/api/owner/profile" || url.pathname === "/api/centres/test-centre") return json(route, { data: centre });
    if (url.pathname === "/api/auth/me") return json(route, { user });
    if (url.pathname === "/api/payments/availability") return json(route, { online_available: true });
    if (url.pathname === "/api/bookings/quote") return json(route, { data: quote });
    if (url.pathname === "/api/bookings/ICCMS-TEST") return json(route, { data: booking });
    return json(route, { data: [] });
  });
  return { page, close: () => context.close() };
}

test("calendar fails closed, retries, and ignores the previous floor response", async () => {
  let phase = "error", release, held = false;
  const { page, close } = await setup(async (route, url) => {
    if (!url.pathname.endsWith("/calendar")) return false;
    if (phase === "error") await json(route, { message: "Unavailable" }, 503);
    else if (url.searchParams.get("floor_id") === "1") { held = true; await new Promise((r) => { release = r; }); await json(route, { data: [{ date: "2026-10-20", full_day: false, any: false }] }); }
    else await json(route, { data: [] });
    return true;
  });
  try {
    await page.goto(`${origin}/calendar`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("button", { name: "October 20: unavailable", exact: true }).isDisabled(), true);
    phase = "hold";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await until(() => held);
    assert.equal(await page.getByRole("button", { name: "October 20: unavailable", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Second floor" }).click();
    await page.getByRole("button", { name: "October 20: available", exact: true }).waitFor();
    release(); await pause(150);
    assert.equal(await page.getByRole("button", { name: "October 20: available", exact: true }).isEnabled(), true);
  } finally { release?.(); await close(); }
});

test("centre fetch failure offers retry and recovers", async () => {
  let calls = 0;
  const { page, close } = await setup(async (route, url) => {
    if (url.pathname !== "/api/centres/test-centre") return false;
    await json(route, ++calls === 1 ? { message: "Server error" } : { data: centre }, calls === 1 ? 500 : 200); return true;
  });
  try {
    await page.goto(`${origin}/centres/test-centre/book`);
    await page.getByText("Could not load centre. Please try again.").waitFor();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("heading", { name: "Choose your booking details" }).waitFor();
  } finally { await close(); }
});

for (const [status, message] of [[500, "Could not load booking. Please try again."], [401, "Please sign in to view this booking."], [404, "Booking not found."]]) {
  test(`booking ${status} state is distinct and retry recovers`, async () => {
    let calls = 0;
    const { page, close } = await setup(async (route, url) => {
      if (url.pathname !== "/api/bookings/ICCMS-TEST") return false;
      await json(route, ++calls === 1 ? { message: "Error" } : { data: booking }, calls === 1 ? status : 200); return true;
    });
    try {
      await page.goto(`${origin}/booking/ICCMS-TEST`);
      await page.getByText(message, { exact: true }).waitFor();
      if (status === 401) assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isVisible(), true);
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.getByRole("heading", { name: "Booking request submitted" }).waitFor();
    } finally { await close(); }
  });
}

test("checkout sends reviewed total and advance recovery requests advance", async () => {
  let payload, payment;
  const { page, close } = await setup(async (route, url) => {
    if (url.pathname === "/api/bookings") { payload = route.request().postDataJSON(); await json(route, { data: booking }, 201); return true; }
    if (url.pathname === "/api/payments/initiate") { payment = route.request().postDataJSON(); await json(route, { message: "Mock gateway unavailable" }, 503); return true; }
    return false;
  }, { draft: { centre, quote, eventDate: "2026-10-20", sessionType: "full_day", guestCount: 100, eventType: "Wedding" } });
  try {
    await page.goto(`${origin}/checkout`);
    await page.getByRole("button", { name: /Pay advance/ }).click();
    await page.getByRole("button", { name: /Review & pay/ }).click();
    await page.getByRole("button", { name: /Confirm & pay/ }).click();
    await page.waitForURL("**/booking/ICCMS-TEST?payment=unavailable");
    assert.equal(payload.expected_total_amount, quote.total_amount);
    assert.equal(payload.payment_option, "advance");
    payment = null;
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
    await page.getByRole("button", { name: /^Pay ৳/ }).click();
    await until(() => payment);
    assert.equal(payment.payment_option, "advance");
  } finally { await close(); }
});

test("flexible quote ignores old response and next day stays correct in Dhaka", async () => {
  let release, held = false;
  const { page, close } = await setup(async (route, url) => {
    if (url.pathname !== "/api/bookings/quote") return false;
    const data = route.request().postDataJSON();
    if (data.guest_count === 200) { held = true; await new Promise((r) => { release = r; }); }
    await json(route, { data: { ...quote, total_amount: data.guest_count === 200 ? 9999 : 1234 } }); return true;
  });
  try {
    await page.goto(`${origin}/flexible`);
    await page.getByRole("button", { name: "October 20: available", exact: true }).click();
    const review = page.getByRole("button", { name: "Review booking", exact: true });
    await until(() => review.isEnabled());
    await page.getByRole("button", { name: "200", exact: true }).click();
    assert.equal(await review.isDisabled(), true);
    await until(() => held);
    await page.getByRole("button", { name: "300", exact: true }).click();
    await until(() => review.isEnabled());
    release(); await pause(150);
    assert.equal(await page.getByText("৳9,999", { exact: true }).count(), 0);
    await page.getByRole("button", { name: /Add.*date/i }).click();
    await page.getByRole("button", { name: "Choose booking date 2 from availability calendar" }).getByText("21/10/2026").waitFor();
  } finally { release?.(); await close(); }
});

test("payment transaction wraps at 320px and desktop", async () => {
  const transaction = `ICCMS${"A".repeat(23)}`;
  const { page, close } = await setup(async (route, url) => {
    if (url.pathname !== "/api/bookings/ICCMS-TEST") return false;
    await json(route, { data: { ...booking, status: "confirmed", paid_amount: quote.total_amount, due_amount: 0, payment: { payment_method: "ekPay", transaction_id: transaction } } }); return true;
  }, { width: 320 });
  try {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${origin}/booking/ICCMS-TEST`);
      const id = page.getByText(transaction, { exact: true });
      await id.waitFor();
      assert.equal(await id.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/cc-booking-qa-screenshots/payment-${width}.png`, fullPage: true });
    }
  } finally { await close(); }
});
