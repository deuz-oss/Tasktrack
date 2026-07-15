"""
TaskTrack Free — a self-hostable, zero-cost clone of the team task-tracking app.

Single FastAPI service that:
  - Serves the React frontend (static/index.html, no build step needed)
  - Exposes a JSON API under /api/*
  - Stores data via SQLAlchemy, so it works with:
      * local SQLite file (default, great for trying it out — but NOTE this
        resets on most free hosts' redeploys, see README)
      * a free hosted Postgres (e.g. Supabase or Neon) for real, persistent
        data — just set the DATABASE_URL environment variable.

Run locally:
    pip install -r requirements.txt --break-system-packages
    uvicorn main:app --host 0.0.0.0 --port 8000

Then open http://localhost:8000
"""
import os
import uuid
import datetime as dt
from contextlib import contextmanager
from typing import Optional

import bcrypt
import jwt
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Config (all overridable via environment variables — no code changes needed
# to deploy on a different host)
# ---------------------------------------------------------------------------
# DATABASE_URL examples:
#   sqlite:///tasktrack.db                       (default — local file)
#   postgresql+psycopg://user:pass@host:5432/dbname (Supabase / Neon / etc.)
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///tasktrack.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@tasktrack.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

IS_SQLITE = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=True,
)


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
    conn = engine.connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row):
    return dict(row._mapping) if row is not None else None


def rows_to_dicts(rows):
    return [dict(r._mapping) for r in rows]


def init_db():
    with get_db() as db:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#8FE3C4',
                created_at TEXT NOT NULL
            )
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                priority TEXT NOT NULL DEFAULT 'medium',
                repeat TEXT NOT NULL DEFAULT 'one-off',
                category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                due_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """))
        admin = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": ADMIN_EMAIL}).fetchone()
        if not admin:
            db.execute(
                text("INSERT INTO users (id, name, email, password_hash, role, created_at) "
                     "VALUES (:id, :name, :email, :password_hash, :role, :created_at)"),
                {"id": str(uuid.uuid4()), "name": "Admin", "email": ADMIN_EMAIL,
                 "password_hash": hash_password(ADMIN_PASSWORD), "role": "admin",
                 "created_at": dt.datetime.utcnow().isoformat()},
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
    priority: str = "medium"  # low | medium | high
    repeat: str = "one-off"  # one-off | daily | weekly | monthly
    category_id: Optional[str] = None
    due_date: Optional[str] = None  # ISO date string, e.g. 2026-07-20


class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    repeat: Optional[str] = None
    category_id: Optional[str] = None
    due_date: Optional[str] = None


class CategoryIn(BaseModel):
    name: str
    color: str = "#8FE3C4"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": dt.datetime.utcnow() + dt.timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def get_current_user(request: Request) -> dict:
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
        user = row_to_dict(db.execute(text("SELECT * FROM users WHERE id = :id"), {"id": payload["sub"]}).fetchone())
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


def user_public(u: dict) -> dict:
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
        existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": body.email}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        uid = str(uuid.uuid4())
        db.execute(
            text("INSERT INTO users (id, name, email, password_hash, role, created_at) "
                 "VALUES (:id, :name, :email, :password_hash, :role, :created_at)"),
            {"id": uid, "name": body.name, "email": body.email,
             "password_hash": hash_password(body.password), "role": "user",
             "created_at": dt.datetime.utcnow().isoformat()},
        )
        user = row_to_dict(db.execute(text("SELECT * FROM users WHERE id = :id"), {"id": uid}).fetchone())
    token = create_token(uid)
    set_auth_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/login")
def login(body: LoginIn, response: Response):
    with get_db() as db:
        user = row_to_dict(db.execute(text("SELECT * FROM users WHERE email = :email"), {"email": body.email}).fetchone())
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
def me(user: dict = Depends(get_current_user)):
    return user_public(user)


# ---------------------------------------------------------------------------
# Task routes (scoped to the logged-in user)
# ---------------------------------------------------------------------------
def is_overdue(t: dict) -> bool:
    if not t["due_date"] or t["status"] == "done":
        return False
    try:
        return dt.date.fromisoformat(t["due_date"]) < dt.date.today()
    except ValueError:
        return False


def task_public(t: dict) -> dict:
    return {
        "id": t["id"], "title": t["title"], "description": t["description"],
        "status": t["status"], "priority": t["priority"], "repeat": t["repeat"],
        "category_id": t["category_id"], "due_date": t["due_date"],
        "created_at": t["created_at"], "updated_at": t["updated_at"],
        "overdue": is_overdue(t),
    }


@api.get("/tasks")
def list_tasks(user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = rows_to_dicts(db.execute(
            text("SELECT * FROM tasks WHERE user_id = :uid ORDER BY created_at DESC"), {"uid": user["id"]}
        ).fetchall())
    return [task_public(t) for t in rows]


@api.post("/tasks", status_code=201)
def create_task(body: TaskIn, user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    now = dt.datetime.utcnow().isoformat()
    with get_db() as db:
        db.execute(
            text("INSERT INTO tasks (id, user_id, title, description, status, priority, repeat, category_id, due_date, created_at, updated_at) "
                 "VALUES (:id, :user_id, :title, :description, :status, :priority, :repeat, :category_id, :due_date, :created_at, :updated_at)"),
            {"id": tid, "user_id": user["id"], "title": body.title, "description": body.description,
             "status": body.status, "priority": body.priority, "repeat": body.repeat,
             "category_id": body.category_id, "due_date": body.due_date, "created_at": now, "updated_at": now},
        )
        row = row_to_dict(db.execute(text("SELECT * FROM tasks WHERE id = :id"), {"id": tid}).fetchone())
    return task_public(row)


@api.put("/tasks/{task_id}")
def update_task(task_id: str, body: TaskUpdateIn, user: dict = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute(
            text("SELECT * FROM tasks WHERE id = :id AND user_id = :uid"), {"id": task_id, "uid": user["id"]}
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        updates = body.dict(exclude_unset=True)
        if updates:
            fields = ", ".join(f"{k} = :{k}" for k in updates)
            params = {**updates, "updated_at": dt.datetime.utcnow().isoformat(), "id": task_id}
            db.execute(text(f"UPDATE tasks SET {fields}, updated_at = :updated_at WHERE id = :id"), params)
        row = row_to_dict(db.execute(text("SELECT * FROM tasks WHERE id = :id"), {"id": task_id}).fetchone())
    return task_public(row)


@api.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute(
            text("SELECT id FROM tasks WHERE id = :id AND user_id = :uid"), {"id": task_id, "uid": user["id"]}
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        db.execute(text("DELETE FROM tasks WHERE id = :id"), {"id": task_id})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Admin routes — team overview with per-user stats (single batched query,
# no N+1 problem)
# ---------------------------------------------------------------------------
@api.get("/admin/users")
def admin_users(admin: dict = Depends(require_admin)):
    with get_db() as db:
        users = rows_to_dicts(db.execute(text("SELECT * FROM users ORDER BY created_at ASC")).fetchall())
        all_tasks = rows_to_dicts(db.execute(text("SELECT * FROM tasks")).fetchall())

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
def admin_tasks(admin: dict = Depends(require_admin)):
    with get_db() as db:
        rows = rows_to_dicts(db.execute(text("""
            SELECT tasks.*, users.name AS owner_name, users.email AS owner_email
            FROM tasks
            JOIN users ON users.id = tasks.user_id
            ORDER BY tasks.created_at DESC
        """)).fetchall())
    result = []
    for t in rows:
        entry = task_public(t)
        entry["owner_name"] = t["owner_name"]
        entry["owner_email"] = t["owner_email"]
        result.append(entry)
    return result


@api.delete("/admin/users/{user_id}", status_code=204)
def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You can't delete your own admin account")
    with get_db() as db:
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Categories — shared across the whole team (like lightweight "projects")
# ---------------------------------------------------------------------------
def category_public(c: dict) -> dict:
    return {"id": c["id"], "name": c["name"], "color": c["color"]}


@api.get("/categories")
def list_categories(user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = rows_to_dicts(db.execute(text("SELECT * FROM categories ORDER BY created_at ASC")).fetchall())
    return [category_public(c) for c in rows]


@api.post("/categories", status_code=201)
def create_category(body: CategoryIn, user: dict = Depends(get_current_user)):
    cid = str(uuid.uuid4())
    with get_db() as db:
        db.execute(
            text("INSERT INTO categories (id, name, color, created_at) VALUES (:id, :name, :color, :created_at)"),
            {"id": cid, "name": body.name, "color": body.color, "created_at": dt.datetime.utcnow().isoformat()},
        )
        row = row_to_dict(db.execute(text("SELECT * FROM categories WHERE id = :id"), {"id": cid}).fetchone())
    return category_public(row)


@api.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    with get_db() as db:
        db.execute(text("DELETE FROM categories WHERE id = :id"), {"id": category_id})
    return Response(status_code=204)


app.mount("/api", api)

# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


@app.get("/{full_path:path}")
def spa(full_path: str):
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
