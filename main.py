"""
TaskTrack Free — a self-hostable, zero-cost clone of the team task-tracking app.

Single FastAPI service that:
  - Serves the React frontend (static/index.html, no build step needed)
  - Exposes a JSON API under /api/*
  - Stores everything in a local SQLite file (tasktrack.db) — no external
    database service, no paid add-ons required.

Run locally:
    pip install -r requirements.txt --break-system-packages
    uvicorn main:app --host 0.0.0.0 --port 8000

Then open http://localhost:8000
"""
import os
import sqlite3
import uuid
import datetime as dt
from contextlib import contextmanager
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, Depends, HTTPException, Response, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Config (all overridable via environment variables — no code changes needed
# to deploy on a different free host)
# ---------------------------------------------------------------------------
DB_PATH = os.environ.get("DB_PATH", "tasktrack.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@tasktrack.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


app = FastAPI(title="TaskTrack Free")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                due_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        admin = db.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,)).fetchone()
        if not admin:
            db.execute(
                "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), "Admin", ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), "admin",
                 dt.datetime.utcnow().isoformat()),
            )


@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TaskIn(BaseModel):
    title: str
    description: str = ""
    status: str = "pending"  # pending | in_progress | done
    due_date: Optional[str] = None  # ISO date string, e.g. 2026-07-20


class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": dt.datetime.utcnow() + dt.timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def get_current_user(request: Request) -> sqlite3.Row:
    token = request.cookies.get("token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_admin(user: sqlite3.Row = Depends(get_current_user)) -> sqlite3.Row:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


def user_public(u: sqlite3.Row) -> dict:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"]}


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="token", value=token, httponly=True, samesite="lax",
        max_age=JWT_EXPIRE_HOURS * 3600, path="/",
    )


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
api = FastAPI()  # sub-app mounted at /api so static files stay separate


@api.post("/auth/register")
def register(body: RegisterIn, response: Response):
    with get_db() as db:
        existing = db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        uid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
            (uid, body.name, body.email, hash_password(body.password), "user", dt.datetime.utcnow().isoformat()),
        )
        user = db.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    token = create_token(uid)
    set_auth_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/login")
def login(body: LoginIn, response: Response):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    set_auth_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("token", path="/")
    return {"ok": True}


@api.get("/auth/me")
def me(user: sqlite3.Row = Depends(get_current_user)):
    return user_public(user)


# ---------------------------------------------------------------------------
# Task routes (scoped to the logged-in user)
# ---------------------------------------------------------------------------
def task_public(t: sqlite3.Row) -> dict:
    return {
        "id": t["id"], "title": t["title"], "description": t["description"],
        "status": t["status"], "due_date": t["due_date"],
        "created_at": t["created_at"], "updated_at": t["updated_at"],
        "overdue": is_overdue(t),
    }


def is_overdue(t) -> bool:
    if not t["due_date"] or t["status"] == "done":
        return False
    try:
        return dt.date.fromisoformat(t["due_date"]) < dt.date.today()
    except ValueError:
        return False


@api.get("/tasks")
def list_tasks(user: sqlite3.Row = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)
        ).fetchall()
    return [task_public(t) for t in rows]


@api.post("/tasks", status_code=201)
def create_task(body: TaskIn, user: sqlite3.Row = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    now = dt.datetime.utcnow().isoformat()
    with get_db() as db:
        db.execute(
            "INSERT INTO tasks (id, user_id, title, description, status, due_date, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (tid, user["id"], body.title, body.description, body.status, body.due_date, now, now),
        )
        row = db.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone()
    return task_public(row)


@api.put("/tasks/{task_id}")
def update_task(task_id: str, body: TaskUpdateIn, user: sqlite3.Row = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        updates = body.dict(exclude_unset=True)
        if updates:
            fields = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [dt.datetime.utcnow().isoformat(), task_id]
            db.execute(f"UPDATE tasks SET {fields}, updated_at = ? WHERE id = ?", values)
        row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return task_public(row)


@api.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: sqlite3.Row = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Admin routes — team overview with per-user stats (single batched query,
# no N+1 problem)
# ---------------------------------------------------------------------------
@api.get("/admin/users")
def admin_users(admin: sqlite3.Row = Depends(require_admin)):
    with get_db() as db:
        users = db.execute("SELECT * FROM users ORDER BY created_at ASC").fetchall()
        all_tasks = db.execute("SELECT * FROM tasks").fetchall()

    tasks_by_user = {}
    for t in all_tasks:
        tasks_by_user.setdefault(t["user_id"], []).append(t)

    result = []
    for u in users:
        u_tasks = tasks_by_user.get(u["id"], [])
        total = len(u_tasks)
        done = sum(1 for t in u_tasks if t["status"] == "done")
        pending = sum(1 for t in u_tasks if t["status"] == "pending")
        in_progress = sum(1 for t in u_tasks if t["status"] == "in_progress")
        overdue = sum(1 for t in u_tasks if is_overdue(t))
        completion_rate = round((done / total) * 100, 1) if total else 0.0
        result.append({
            **user_public(u),
            "total": total, "done": done, "pending": pending,
            "in_progress": in_progress, "overdue": overdue,
            "completion_rate": completion_rate,
        })
    return result


@api.get("/admin/tasks")
def admin_tasks(admin: sqlite3.Row = Depends(require_admin)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM tasks ORDER BY created_at DESC").fetchall()
    return [task_public(t) for t in rows]


@api.delete("/admin/users/{user_id}", status_code=204)
def admin_delete_user(user_id: str, admin: sqlite3.Row = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You can't delete your own admin account")
    with get_db() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return Response(status_code=204)


app.mount("/api", api)

# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")


@app.get("/{full_path:path}")
def spa(full_path: str):
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
