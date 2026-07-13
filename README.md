# TaskTrack Free

A self-hostable clone of your team task-tracking app — same core idea (personal
task boards + an admin "Team" overview with per-user completion stats), but
built to run at **zero cost**, with no Emergent credits and no paid database.

## What's inside

- **One FastAPI service** (`main.py`) that serves both the API (`/api/*`) and
  the frontend, so you only need to deploy a single app.
- **SQLite** (`tasktrack.db`, created automatically) instead of MongoDB — no
  external database service to pay for or configure.
- **Single-file React frontend** (`static/index.html`) loaded from a CDN
  (React, no build step, no Node.js required to run it).
- JWT auth via an httpOnly cookie, same pattern as the original app.
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

## Configuration

Everything is controlled by environment variables, no code edits needed:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | *(placeholder)* | **Change this** — signs login sessions |
| `ADMIN_EMAIL` | `admin@tasktrack.com` | Seeded admin account email |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin account password |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed origins |
| `DB_PATH` | `tasktrack.db` | SQLite file location |

## Deploying for free

Because it's a single Python service with a file-based database, any free
tier that runs a Python web service works. Two easy options:

### Option A — Render (free web service)
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), create a new **Web Service** from
   that repo.
3. Build command: `pip install -r requirements.txt`
   Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the environment variables above (at least `JWT_SECRET`,
   `ADMIN_PASSWORD`).
5. Deploy — Render gives you a free `.onrender.com` URL.

   ⚠️ Free Render services spin down after inactivity and use an **ephemeral
   filesystem** — the SQLite file resets on redeploy/restart. Fine for a demo
   or a small team that doesn't mind occasional resets; for permanent data,
   attach a persistent disk (paid) or point `DB_PATH` at a mounted volume.

### Option B — Railway / Fly.io free tier
Same idea: one Python service, same build/start commands, same environment
variables. Both offer free tiers with similar ephemeral-storage caveats.

### Keeping data permanently, still for free
If you need data to survive restarts without paying for storage, swap SQLite
for a free-tier hosted Postgres (e.g. Supabase or Neon both have free plans)
by changing the `get_db()` function in `main.py` — everything else stays the
same.

## Notes on parity with the original app

This covers the same core loop as your Emergent app ("TaskTrack"): register/
login, personal task board with pending/in-progress/done status, due dates
with overdue detection, and an admin Team page with per-user stats computed
in a single batched query (no N+1 issue). It intentionally doesn't include
things you hadn't asked for yet (e.g. an "invite teammate" button) — easy to
add on top of this same file if you want them later.
