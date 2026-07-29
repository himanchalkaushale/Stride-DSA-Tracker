import type { CustomProblemInput } from "@/types/models";
import { normalizeTopics } from "./constants.ts";

export interface CsvPlanRow {
  rowNumber: number;
  taskDate: string;
  question: CustomProblemInput;
}

export interface CsvPlanOptions {
  startDate: string;
  questionsPerDay: number;
  topicOverride?: string;
}

const aliases = {
  title: ["title", "problem", "question", "problem_title", "question_title"],
  date: ["date", "task_date", "plan_date", "scheduled_date"],
  topic: ["topic", "topics"],
  difficulty: ["difficulty", "level"],
  link: ["link", "url", "problem_link", "leetcode_link", "external_url"],
  description: ["description", "notes", "problem_description"],
  patterns: ["pattern", "patterns"],
  source: ["source", "platform"],
  minutes: ["estimated_minutes", "minutes", "time"],
} as const;

function parseCsvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  return rows;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validDateKey(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDate(value: string, rowNumber: number) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{1,2}|\d{4})$/);
  if (iso) {
    const [, year, month, day] = iso.map(Number);
    if (validDateKey(year, month, day)) return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    const year = local[3].length === 1
      ? 2020 + Number(local[3])
      : local[3].length === 2
        ? 2000 + Number(local[3])
        : Number(local[3]);
    if (validDateKey(year, month, day)) return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }
  throw new Error(`Row ${rowNumber}: date “${value}” must use YYYY-MM-DD or DD/MM/YYYY.`);
}

function findColumn(headers: string[], names: readonly string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function list(value: string) {
  return value.split(/[|;,]/).map((item) => item.trim()).filter(Boolean);
}

function sourceFrom(link: string) {
  if (!link) return "CSV import";
  try {
    const hostname = new URL(link).hostname.replace(/^www\./, "");
    if (hostname.includes("leetcode")) return "LeetCode";
    return hostname || "CSV import";
  } catch {
    return "CSV import";
  }
}

export function parsePlanCsv(text: string, options: CsvPlanOptions): CsvPlanRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate)) throw new Error("Choose a valid start date.");
  if (!Number.isInteger(options.questionsPerDay) || options.questionsPerDay < 1 || options.questionsPerDay > 20) {
    throw new Error("Questions per day must be between 1 and 20.");
  }

  const rows = parseCsvCells(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one question.");

  const headers = rows[0].map((header) => header.toLowerCase().trim().replace(/\s+/g, "_"));
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [key, findColumn(headers, names)]),
  ) as Record<keyof typeof aliases, number>;
  if (columns.title < 0) throw new Error("Add a title, problem, or question column to the CSV.");

  const errors: string[] = [];
  const result: CsvPlanRow[] = [];
  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const read = (column: number) => column >= 0 ? (cells[column] ?? "").trim() : "";
    const title = read(columns.title);
    if (!title) {
      errors.push(`Row ${rowNumber}: question title is missing.`);
      return;
    }

    const difficultyValue = read(columns.difficulty).toLowerCase() || "medium";
    if (!["easy", "medium", "hard"].includes(difficultyValue)) {
      errors.push(`Row ${rowNumber}: difficulty must be easy, medium, or hard.`);
      return;
    }

    const link = read(columns.link);
    if (link) {
      try {
        const url = new URL(link);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        errors.push(`Row ${rowNumber}: link must begin with http:// or https://.`);
        return;
      }
    }

    const minutesValue = read(columns.minutes);
    const minutes = minutesValue ? Number(minutesValue) : 30;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
      errors.push(`Row ${rowNumber}: estimated minutes must be between 1 and 600.`);
      return;
    }

    try {
      const explicitDate = read(columns.date);
      const taskDate = explicitDate
        ? normalizeDate(explicitDate, rowNumber)
        : addDays(options.startDate, Math.floor(index / options.questionsPerDay));
      const csvTopics = list(read(columns.topic));
      const planTopics = options.topicOverride ? normalizeTopics([options.topicOverride]) : normalizeTopics(csvTopics);
      result.push({
        rowNumber,
        taskDate,
        question: {
          title,
          description: read(columns.description) || null,
          difficulty: difficultyValue as CustomProblemInput["difficulty"],
          topics: planTopics,
          patterns: [...new Set([
            ...(options.topicOverride ? csvTopics : []),
            ...list(read(columns.patterns)),
          ])],
          source: read(columns.source) || sourceFrom(link),
          externalUrl: link || null,
          estimatedMinutes: minutes,
        },
      });
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : `Row ${rowNumber}: invalid data.`);
    }
  });

  if (errors.length) {
    const visible = errors.slice(0, 6).join("\n");
    throw new Error(errors.length > 6 ? `${visible}\n…and ${errors.length - 6} more errors.` : visible);
  }
  if (!result.length) throw new Error("No questions were found in the CSV.");
  return result;
}

export const PLAN_CSV_TEMPLATE = [
  "title,topic,difficulty,link,date,estimated_minutes,patterns,description",
  'Reverse Linked List,Linked Lists,easy,https://leetcode.com/problems/reverse-linked-list/,,25,Pointer Reversal,"Reverse a singly linked list"',
  "Linked List Cycle,Linked Lists,easy,https://leetcode.com/problems/linked-list-cycle/,,25,Fast and Slow Pointers,",
].join("\n");
