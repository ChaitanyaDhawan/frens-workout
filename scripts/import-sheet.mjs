#!/usr/bin/env node
// FRENS — import 2026 workout history from the Google Sheet into `workouts`.
//
// The sheet is a grid: one row per person, one column per day of 2026
// (col 1 = name, col 2 = Jan 1 2026 = Thursday, TRUE = worked out).
// Each TRUE cell becomes one workout row on that exact date, source='sheet'.
// Idempotent: ON CONFLICT (member_id, workout_date) DO NOTHING — app rows always win,
// so this is safe to re-run (dev import now, reconciliation at cutover).
//
// Usage:
//   node scripts/import-sheet.mjs --dry-run     # print per-person counts, write nothing
//   node scripts/import-sheet.mjs               # emit SQL to stdout (pipe into psql)
//
// Radhika is a new member with no sheet history — skipped. Tarang left the group and
// is not a member — skipped. Both are simply absent from MEMBERS below.

const SHEET_ID = '1U8mqV1eZ-yRSxVYrOzsoJW-p8hjE7oOPPFaH7A1qPqI';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Names as they appear in BOTH the sheet's first column and members.sheet_name.
const MEMBERS = new Set([
  'Abhimanyu','Akshit','Bhawna','Chaitanya','Mugdha','Rahul',
  'Saksham','Saurabh','Shashwat N.','Vareni','Shaswat K.','Saavy',
]);

const BASE = Date.UTC(2026, 0, 1); // Jan 1 2026 (day index 1)
const iso = (dayIdx) => new Date(BASE + (dayIdx - 1) * 86400000).toISOString().slice(0, 10);

const dryRun = process.argv.includes('--dry-run');

const res = await fetch(CSV_URL);
if (!res.ok) { console.error(`Failed to fetch sheet: ${res.status}`); process.exit(1); }
const csv = await res.text();

// Person rows are plain TRUE/FALSE with no embedded commas — a naive split is safe.
// (Row 1's title cell has a quoted newline but never starts with a member name.)
const rows = [];       // {name, dates: [isoDate, ...]}
const counts = {};
for (const line of csv.split('\n')) {
  const cells = line.split(',');
  const name = (cells[0] || '').trim();
  if (!MEMBERS.has(name)) continue;
  const dates = [];
  for (let j = 1; j < cells.length; j++) {
    if (cells[j].trim() === 'TRUE') dates.push(iso(j)); // col j → day index j
  }
  rows.push({ name, dates });
  counts[name] = dates.length;
}

// Report counts to stderr (visible in both modes).
let total = 0;
console.error('Per-person workout days imported from sheet:');
for (const name of [...MEMBERS]) {
  const c = counts[name] ?? 0; total += c;
  console.error(`  ${name.padEnd(12)} ${c}`);
}
console.error(`  ${'TOTAL'.padEnd(12)} ${total}`);

if (dryRun) process.exit(0);

// Emit a single INSERT ... SELECT ... FROM (VALUES ...) JOIN members.
const values = rows.flatMap(r => r.dates.map(d => `(${sql(r.name)}, DATE ${sql(d)})`));
if (!values.length) { console.error('No TRUE cells found — nothing to import.'); process.exit(1); }
process.stdout.write(
`INSERT INTO workouts (member_id, workout_date, source)
SELECT m.id, v.d, 'sheet'
FROM (VALUES
  ${values.join(',\n  ')}
) AS v(name, d)
JOIN members m ON m.sheet_name = v.name
ON CONFLICT (member_id, workout_date) DO NOTHING;
`);

function sql(s) { return `'${String(s).replace(/'/g, "''")}'`; }
