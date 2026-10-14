import { test } from "node:test";
import { strict as assert } from "node:assert";
import { tourUrl } from "./tourUrl.js";

test("accepts configured web tours", () => {
  assert.equal(tourUrl(" https://example.com/360/ "), "https://example.com/360/");
  assert.equal(tourUrl("http://example.com/tour"), "http://example.com/tour");
});

test("hides absent and unsafe tour links", () => {
  for (const value of [null, "", "javascript:alert(1)", "data:text/html,hi", "ftp://example.com/tour", "https://user:pass@example.com/tour", "not a URL"]) {
    assert.equal(tourUrl(value), null);
  }
});
