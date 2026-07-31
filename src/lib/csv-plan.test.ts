import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_CSV_FILE_BYTES, parsePlanCsv } from "./csv-plan.ts";

describe("CSV monthly plan import", () => {
  it("distributes rows across days using the chosen daily count", () => {
    const rows = parsePlanCsv([
      "title,topic,difficulty,link",
      "One,linked list,easy,https://example.com/one",
      "Two,LinkedList,medium,https://example.com/two",
      "Three,Trees,hard,https://example.com/three",
    ].join("\n"), { startDate: "2026-07-29", questionsPerDay: 2 });

    assert.deepEqual(rows.map((row) => row.taskDate), ["2026-07-29", "2026-07-29", "2026-07-30"]);
    assert.deepEqual(rows[0].question.topics, ["Linked Lists"]);
    assert.deepEqual(rows[1].question.topics, ["Linked Lists"]);
  });

  it("honors explicit DD/MM/YYYY and ISO dates", () => {
    const rows = parsePlanCsv([
      "question,date",
      "First,29/7/6",
      "Second,2026-08-01",
    ].join("\n"), { startDate: "2026-01-01", questionsPerDay: 2 });

    assert.deepEqual(rows.map((row) => row.taskDate), ["2026-07-29", "2026-08-01"]);
  });

  it("supports quoted commas and reports invalid links", () => {
    const quoted = parsePlanCsv('title,topics\n"Merge, then sort","Arrays;Sorting"', {
      startDate: "2026-07-29",
      questionsPerDay: 2,
    });
    assert.equal(quoted[0].question.title, "Merge, then sort");
    assert.deepEqual(quoted[0].question.topics, ["Arrays", "Sorting"]);

    assert.throws(() => parsePlanCsv("title,link\nBroken,leetcode.com/problem", {
      startDate: "2026-07-29",
      questionsPerDay: 2,
    }), /HTTP/);
  });

  it("assigns a parent topic while preserving CSV subtopics as patterns", () => {
    const rows = parsePlanCsv("title,topic,patterns\nReverse Nodes,Advanced Reversal,k-group", {
      startDate: "2026-07-29",
      questionsPerDay: 2,
      topicOverride: "Linked Lists",
    });
    assert.deepEqual(rows[0].question.topics, ["Linked Lists"]);
    assert.deepEqual(rows[0].question.patterns, ["Advanced Reversal", "k-group"]);
  });

  it("rejects oversized files and credential-bearing links", () => {
    assert.throws(() => parsePlanCsv(`title\n${"a".repeat(MAX_CSV_FILE_BYTES)}`, {
      startDate: "2026-07-29", questionsPerDay: 2,
    }), /1 MB/);
    assert.throws(() => parsePlanCsv("title,link\nBad,https://user:secret@example.com/problem", {
      startDate: "2026-07-29", questionsPerDay: 2,
    }), /credentials/);
  });
});
