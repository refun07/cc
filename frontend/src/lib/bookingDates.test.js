import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays } from "./bookingDates.js";

for (const timezone of ["Asia/Dhaka", "UTC", "America/New_York"]) {
  test(`calendar day arithmetic preserves dates in ${timezone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    try {
      assert.equal(addCalendarDays("2026-10-20"), "2026-10-21");
      assert.equal(addCalendarDays("2026-12-31"), "2027-01-01");
      assert.equal(addCalendarDays("2028-02-28"), "2028-02-29");
      assert.equal(addCalendarDays("2026-03-08"), "2026-03-09");
      assert.equal(addCalendarDays("2026-11-01"), "2026-11-02");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}
