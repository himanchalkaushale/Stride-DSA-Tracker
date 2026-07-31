import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateKey, formatTimestamp } from "./date-format.ts";

describe("deterministic date formatting", () => {
  it("formats calendar dates with an explicit locale and stable day", () => {
    assert.equal(
      formatDateKey("2026-08-01", { weekday: "short", month: "short", day: "numeric" }),
      "Sat, Aug 1",
    );
  });

  it("formats instants in the saved user timezone", () => {
    assert.equal(
      formatTimestamp("2026-07-30T20:00:00.000Z", "Asia/Calcutta"),
      "Jul 31, 2026, 1:30 AM",
    );
  });

  it("falls back to UTC when a stored timezone is invalid", () => {
    assert.equal(
      formatTimestamp("2026-07-30T20:00:00.000Z", "Invalid/Zone"),
      "Jul 30, 2026, 8:00 PM",
    );
  });
});
