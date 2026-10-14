import test from "node:test";
import assert from "node:assert/strict";
import { youtubeVideoId } from "./youtube.js";

test("accepts YouTube watch, short, and share URLs", () => {
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ/"), "dQw4w9WgXcQ");
});

test("rejects non-YouTube and non-HTTPS embeds", () => {
  assert.equal(youtubeVideoId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeVideoId("javascript:alert(1)"), null);
});
