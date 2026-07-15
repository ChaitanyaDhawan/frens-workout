# FRENS Workout

A workout tracker for a group of friends — replacing a shared Google Sheet with a fast, installable web app. One tap to log your workout, a live quarterly leaderboard, and a feed where everyone cheers each other on.

**Live:** https://frens-workout.vercel.app

## What it does

- **One-tap logging** — hold to confirm; optional activity, duration, note, and photo proof.
- **Live leaderboard** — workout-days per quarter, plus 2026 / 2025 / All-time boards. Rolls to the next quarter automatically.
- **The feed** — every log lands as a card; give 🔥 kudos and drop a comment.
- **Push notifications** — know the moment a fren works out (from the installed app).
- **Your record** — a month calendar of green ticks, streaks, and a 30-day activity strip.
- **Installs to the home screen** on iOS and Android — no App Store.

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js (App Router) · TypeScript · Tailwind · Framer Motion, on Vercel |
| Backend | Supabase — Postgres + Row-Level Security, Auth (email OTP), Realtime, Storage |
| Push | Web Push (VAPID) via a Supabase Edge Function on database webhooks |

Runs entirely on free tiers.

## Run it locally

```bash
cd app
npm install
npm run dev
```

Needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `app/.env.local`. Secrets live outside the repo — never commit `.env*`.

## Contributing

PRs welcome. `main` is protected: open a pull request and it gets reviewed before merging.

## Design

"The Record" — an athletic-club record book: warm paper, ink, oxblood, split-flap counters, and a "do not cheat" stamp in the logging flow.
