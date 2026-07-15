# TaskTrack Free

A self-hostable clone of your team task-tracking app — personal task boards,
categories/projects, priorities, due dates, repeat, and an admin "Team"
overview with per-user completion stats — built to run at **zero cost**.

## ⚠️ Important: use a persistent database in production

By default this app stores data in a local SQLite file. That's great for
running it on your own machine, but **most free hosts (including Render's
free web services) wipe local files every time the service redeploys,
restarts, or spins down from inactivity.** If your team's tasks have
disappeared after a while, this is why — it's not a bug, it's how free-tier
ephemeral filesystems work.

**The fix:** point the app at a free *hosted* Postgres database instead (e.g.
Supabase or Neon). The database then lives outside your web service, so it
survives redeploys, restarts, and spin-downs. See "Set up a free persistent
database" below — it takes about 5 minutes.

## What's inside

- **One FastAPI service** (`main.py`) that serves both the API (`/api/*`) and
  the frontend, so you only need to deploy a single app.
- **SQLAlchemy** data layer that works with either local SQLite (quick start)
  or Postgres (persistent, production) — just set one environment variable.
- **Single-file React frontend** (`static/index.html`) loaded from a CDN
  (React, no build step, no Node.js required to run it).
- JWT auth via an httpOnly cookie.
- An admin account is auto-created on first run.

## Run it locally

```bash
pip install -r requirements.txt --break-system-packages   # or use a venv
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000**. Log in with the seeded admin account:

- Email: `admin@tasktrack.com`
- Password: `admin123`

(Change these before deploying anywhere public — see Configuration below.)

## Set up a free persistent database (recommended before real use)

1. Go to [supabase.com](https://supabase.com) and create a free account +
   new project (also free).
2. In your project, go to **Settings → Database → Connection string** and
   copy the **URI** (it looks like
   `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`).
3. Turn that into your `DATABASE_URL` environment variable, changing the
   scheme prefix to `postgresql+psycopg2://` so SQLAlchemy picks the right
   driver:
   ```
   DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
4. Set that as an environment variable wherever you deploy (see below).
   That's it — the app creates its tables automatically on first startup.

Supabase's free tier keeps your data indefinitely; a project only *pauses*
after 7 days with zero API activity (data is retained, you just click
"resume" in the Supabase dashboard). A team using the app regularly won't hit
this.

## Configuration

Everything is controlled by environment variables, no code edits needed:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///tasktrack.db` | Set to a Postgres URL (see above) for persistent data |
| `JWT_SECRET` | *(placeholder)* | **Change this** — signs login sessions |
| `ADMIN_EMAIL` | `admin@tasktrack.com` | Seeded admin account email |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin account password |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed origins |

## Deploying for free

### Render (free web service)
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), create a new **Web Service** from
   that repo.
3. Build command: `pip install -r requirements.txt`
   Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables: `DATABASE_URL` (your Supabase URL), `JWT_SECRET`,
   `ADMIN_PASSWORD`.
5. Deploy — Render gives you a free `.onrender.com` URL.

   Free Render services still spin down after 15 minutes of inactivity and
   take about a minute to wake back up on the next request — that's just a
   cold-start delay, not data loss, as long as `DATABASE_URL` points to
   Supabase/Neon rather than the default local SQLite file.

### Railway / Fly.io free tier
Same idea: one Python service, same build/start commands, same environment
variables (including `DATABASE_URL` pointed at your Supabase project).

## Notes on parity with the original app

This covers the same core loop as your Emergent app ("TaskTrack"): register/
login, personal task board with pending/in-progress/done status, priorities,
categories/projects, repeat (daily/weekly/monthly), due dates with overdue
detection, and an admin Team page with per-user stats computed in a single
batched query (no N+1 issue).
