// Sample data for the no-login demo mode (?demo=1), used to screenshot the
// CURRENT app for marketing/launch material without touching the live group.
// Not imported anywhere in the normal auth'd flow.

import type { DbMember, DbWorkout, DbReaction, DbComment, DbIntegrationRequest, RawData } from "./db";

const id = (p: string, n: number) => `demo-${p}-${n}`;
const pad = (n: number) => String(n).padStart(2, "0");
const julyIso = (day: number) => `2026-07-${pad(day)}`;

interface Spec {
  name: string;
  sheet: string;
  admin?: boolean;
  july: number; // Q3 workouts this month → drives the podium
}

const SPECS: Spec[] = [
  { name: "Mugdha", sheet: "Mugdha", july: 13 },
  { name: "Abhimanyu", sheet: "Abhimanyu", july: 11 },
  { name: "Vareni", sheet: "Vareni", july: 10 },
  { name: "Rahul", sheet: "Rahul", july: 8 },
  { name: "Saksham", sheet: "Saksham", july: 7 },
  { name: "Chaitanya", sheet: "Chaitanya", admin: true, july: 6 },
  { name: "Shaswat K.", sheet: "Shaswat K.", july: 5 },
  { name: "Saavy", sheet: "Saavy", july: 4 },
  { name: "Shashwat N.", sheet: "Shashwat N.", july: 3 },
  { name: "Akshit", sheet: "Akshit", july: 3 },
  { name: "Bhawna", sheet: "Bhawna", july: 2 },
  { name: "Saurabh", sheet: "Saurabh", july: 1 },
  { name: "Radhika", sheet: "Radhika", july: 1 },
];

const ME_INDEX = 5; // Chaitanya
export const DEMO_ME_ID = id("m", ME_INDEX);

const ACTS = ["Gym workout", "Run", "Yoga", "Badminton", "Swim", "Cycling", "Pilates", "Football"];
const NOTES = [
  "Push day. Bench moved easy 💪",
  "5k before work. Legs fresh.",
  "Morning yoga, felt unreal.",
  "Court was packed — great rallies.",
  "New PB on deadlifts 🔥",
  "",
  "Quick one but it counts.",
  "Evening swim to cool off.",
];
const CMTS = ["Beast 💪", "Let's gooo", "Inspiring 🔥", "Nice one!", "Show off 😄", "Respect."];

function build(): RawData {
  const members: DbMember[] = SPECS.map((s, i) => ({
    id: id("m", i),
    sheet_name: s.sheet,
    user_id: i === ME_INDEX ? "demo-user" : null,
    display_name: s.name,
    is_admin: !!s.admin,
  }));

  const workouts: DbWorkout[] = [];
  let w = 0;
  SPECS.forEach((s, i) => {
    // Vary the pattern so the leaderboard sub-labels differ: most are active
    // today, a few were last active yesterday, some go alternate-day (no streak).
    const start = i % 3 === 2 ? 14 : 15;
    const step = i % 4 === 3 ? 2 : 1;
    let day = start;
    for (let k = 0; k < s.july && day >= 1; k++, day -= step) {
      const isApp = k < 2; // two most recent per person are detailed "app" entries → feed
      workouts.push({
        id: id("w", w++),
        member_id: id("m", i),
        workout_date: julyIso(day),
        types: isApp ? [ACTS[(i + k) % ACTS.length]] : [],
        duration_min: isApp ? [30, 45, 60, 90][(i + k) % 4] : null,
        note: isApp ? NOTES[(i + k) % NOTES.length] : null,
        photo_path: null,
        source: isApp ? "app" : "sheet",
        logged_at: `${julyIso(day)}T${pad(5 + ((i + k) % 14))}:${pad((i * 7 + k) % 60)}:00Z`,
      });
    }
  });

  const reactions: DbReaction[] = [];
  const comments: DbComment[] = [];
  const appWorkouts = workouts.filter((x) => x.source === "app");
  appWorkouts.forEach((x, i) => {
    const kudos = 1 + (i % 6);
    for (let j = 0; j < kudos; j++) {
      const mid = id("m", (i + j + 1) % SPECS.length);
      if (mid === x.member_id) continue;
      reactions.push({ id: id("r", i * 10 + j), workout_id: x.id, member_id: mid, emoji: "🔥" });
    }
    if (i % 2 === 0) {
      comments.push({
        id: id("c", i),
        workout_id: x.id,
        member_id: id("m", (i + 3) % SPECS.length),
        body: CMTS[i % CMTS.length],
        created_at: x.logged_at,
      });
    }
  });

  // A little demand on two upcoming sources — Chaitanya (me) has already asked
  // for Whoop, so the demo shows both the "you asked" and populated states.
  const rq = (src: string, mi: number, mins: number): DbIntegrationRequest => ({
    id: id(`ir-${src}`, mi),
    source: src,
    member_id: id("m", mi),
    created_at: `2026-07-16T${pad(9 + (mi % 8))}:${pad(mins)}:00Z`,
  });
  const integrationRequests: DbIntegrationRequest[] = [
    rq("whoop", 0, 10),
    rq("whoop", 2, 22),
    rq("whoop", ME_INDEX, 31),
    rq("whoop", 8, 47),
    rq("strava", 1, 15),
    rq("strava", 3, 40),
  ];

  return { members, workouts, reactions, comments, integrationRequests, photoUrls: {} };
}

export const SAMPLE_RAW: RawData = build();
