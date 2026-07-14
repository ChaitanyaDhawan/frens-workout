# FRENS Workout — one-time setup (~10 min, all free)

> **Status (2026-07-15):** Project created (`guyrxmiltskqdrfkfjie`) and **schema already applied by Claude** (13 members, RLS, RPCs, realtime, storage — verified; 2026 history imported, 319 rows). So **skip steps 1–2 below.** Remaining: finish **step 3 (Google sign-in)**, then send the **service_role key** + choose the **passcode**.

You do the account-bound steps below; I do everything else. When you finish, paste me the values at the bottom.

## 1. Create the Supabase project (~3 min)
1. Go to https://supabase.com → sign in with Google → **New project**.
2. Name: `frens`. Region: **Mumbai (ap-south-1)**. Set a database password (save it somewhere).
3. Wait for it to finish provisioning (~2 min).

## 2. Apply the schema (~1 min)
1. In the project: **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_frens.sql`, **replace `CHANGE_ME`** (bottom line) with the group passcode you'll share with FRENS, paste the whole file, **Run**.
3. It creates all tables, security, the 13 members, and your passcode. "Success. No rows returned" = done.

## 3. Google sign-in (~4 min)
1. https://console.cloud.google.com → create/select a project → **APIs & Services → OAuth consent screen** → External → fill app name "FRENS Workout" + your email → Save (Testing mode is fine).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs** add the callback URL from Supabase: in Supabase go to **Authentication → Providers → Google**, copy the **Callback URL** shown there, paste it into Google.
4. Google gives you a **Client ID** + **Client secret** → paste both into that Supabase Google provider screen → **Enable** → Save.

## 4. Send me these 3 values
From Supabase **Project Settings → API**:

| Value | Where | Used for |
|---|---|---|
| Project URL | Settings → API → Project URL | app config |
| `anon` public key | Settings → API → Project API keys → `anon` | app config (safe to expose) |
| `service_role` key | Settings → API → Project API keys → `service_role` | **local only** — the sheet import script; never goes in the app |

Also tell me the **passcode** you set, so I can confirm the flow end-to-end.

That's it — everything else (app build, import, push, deploy) is on me.
