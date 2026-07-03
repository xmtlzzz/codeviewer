import { filterDailyStatsByRange } from "./dashboardStats.ts";
import type { DailyStat } from "./types";

function stat(date: string): DailyStat {
  return {
    date,
    insertions: 1,
    deletions: 0,
    files_changed: 1,
    commits: 1,
    repo_name: "repo",
  };
}

function expectDates(actual: DailyStat[], expected: string[]) {
  const dates = actual.map((day) => day.date);
  if (JSON.stringify(dates) !== JSON.stringify(expected)) {
    throw new Error(`expected ${expected.join(",")}, got ${dates.join(",")}`);
  }
}

const sample = [
  stat("2026-05-31"),
  stat("2026-06-03"),
  stat("2026-06-04"),
  stat("2026-06-27"),
  stat("2026-06-28"),
  stat("2026-07-03"),
];

expectDates(filterDailyStatsByRange(sample, "today", "2026-07-03"), ["2026-07-03"]);
expectDates(filterDailyStatsByRange(sample, "7d", "2026-07-03"), [
  "2026-06-27",
  "2026-06-28",
  "2026-07-03",
]);
expectDates(filterDailyStatsByRange(sample, "30d", "2026-07-03"), [
  "2026-06-04",
  "2026-06-27",
  "2026-06-28",
  "2026-07-03",
]);
