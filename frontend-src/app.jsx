const { useState, useEffect, useCallback } = React;

const INK = "#111111";
const BG = "#F2EFE7";
const RED = "#FF4B3E";
const YELLOW = "#F3D34A";
const PURPLE = "#C9B7F0";
const MINT = "#8FE3C4";
const SWATCHES = [MINT, YELLOW, RED, PURPLE, "#DADADA", "#F5B8C4", "#A9D3F0", "#F5C99B"];
const priorityColor = { high: RED, medium: YELLOW, low: MINT };
const mono = "'IBM Plex Mono', monospace";
const display = "'Archivo Black', sans-serif";
const cardStyle = { background: "#fff", border: `2px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}` };

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.detail) || "Something went wrong");
  return data;
}

function fmtDate(d) {
  const [y, m, day] = d.split("-");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
}

function Pill({ children, bg, color = INK, border = true }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: mono, fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5,
      background: bg || "#fff", color, padding: "3px 8px",
      border: border ? `2px solid ${INK}` : "none",
    }}>{children}</span>
  );
}

function StatCard({ label, value, bg }) {
  return (
    <div style={{ ...cardStyle, background: bg || "#fff", padding: "16px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: bg ? INK : "#8a8a8a" }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 34, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: 18 }}>T</div>
      <div>
        <div style={{ fontFamily: display, fontSize: 16, letterSpacing: 0.5 }}>TASKTRACK</div>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1, color: "#8a8a8a" }}>TEAM PLANNER</div>
      </div>
    </div>
  );
}

function NavButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", background: active ? INK : "transparent", color: active ? "#fff" : INK,
      border: "none", cursor: "pointer", fontFamily: mono, fontSize: 12, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5,
    }}>{label}</button>
  );
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", body: JSON.stringify(body) });
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%", border: `2px solid ${INK}`, padding: "10px 12px", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: BG, backgroundImage: "radial-gradient(#d8d3c4 1px, transparent 1px)", backgroundSize: "16px 16px", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...cardStyle, width: 380, padding: 28 }}>
        <Logo />
        <h1 style={{ fontFamily: display, fontSize: 26, margin: "20px 0 4px" }}>{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</h1>
        <p style={{ color: "#8a8a8a", fontSize: 13, margin: "0 0 18px" }}>
          {mode === "login" ? "Welcome back — pick up where the team left off." : "Join the team ledger in seconds."}
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && <input placeholder="Full name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />}
          <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          <input type="password" placeholder="Password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle} />
          {error && <div style={{ color: RED, fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <button disabled={loading} style={{ marginTop: 4, padding: "12px 0", background: INK, color: "#fff", border: "none", fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer" }}>
            {loading ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 13, color: "#8a8a8a", textAlign: "center" }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <a href="#" onClick={e => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ color: INK, fontWeight: 700 }}>
            {mode === "login" ? "Create one" : "Sign in"}
          </a>
        </div>
        <div style={{ marginTop: 14, fontFamily: mono, fontSize: 11, color: "#8a8a8a", borderTop: `2px solid ${INK}`, paddingTop: 12 }}>
          Admin demo: admin@tasktrack.com / admin123
        </div>
      </div>
    </div>
  );
}

function NewTaskModal({ onClose, categories, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState("one-off");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title, description, priority, status, repeat,
          category_id: categoryId || null, due_date: dueDate || null,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const inputStyle = { width: "100%", border: `2px solid ${INK}`, padding: "9px 10px", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }}>
      <form onSubmit={submit} style={{ ...cardStyle, width: 440, maxWidth: "100%", padding: 24, boxShadow: `6px 6px 0 ${INK}`, margin: "20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 20 }}>NEW TASK</h2>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>

        <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>TITLE</label>
        <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ship the landing page" style={{ ...inputStyle, margin: "6px 0 14px" }} />

        <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>NOTES</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Details, links, subtasks…" rows={2} style={{ ...inputStyle, margin: "6px 0 14px", resize: "vertical" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>PRIORITY</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {["low", "medium", "high"].map(p => (
                <button type="button" key={p} onClick={() => setPriority(p)} style={{
                  flex: 1, padding: "8px 0", border: `2px solid ${INK}`, cursor: "pointer",
                  background: priority === p ? priorityColor[p] : "#fff",
                  fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>STATUS</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>CATEGORY</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>DUE DATE</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
          </div>
        </div>

        <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>REPEAT</label>
        <div style={{ display: "flex", gap: 6, margin: "6px 0 18px" }}>
          {["one-off", "daily", "weekly", "monthly"].map(r => (
            <button type="button" key={r} onClick={() => setRepeat(r)} style={{
              flex: 1, padding: "8px 4px", border: `2px solid ${INK}`, cursor: "pointer",
              background: repeat === r ? INK : "#fff", color: repeat === r ? "#fff" : INK,
              fontFamily: mono, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
            }}>{r}</button>
          ))}
        </div>

        {error && <div style={{ color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px 0", border: `2px solid ${INK}`, background: "#fff", fontFamily: mono, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>CANCEL</button>
          <button type="submit" style={{ flex: 1, padding: "12px 0", border: `2px solid ${INK}`, background: INK, color: "#fff", fontFamily: mono, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>CREATE TASK</button>
        </div>
      </form>
    </div>
  );
}

function TaskListItem({ t, categories, onToggleDone, onDelete }) {
  const cat = categories.find(c => c.id === t.category_id);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `2px solid ${INK}`, flexWrap: "wrap" }}>
      <button onClick={() => onToggleDone(t)} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${INK}`, flexShrink: 0, background: t.status === "done" ? INK : "#fff", cursor: "pointer" }} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, fontSize: 15, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "#999" : INK }}>{t.title}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Pill bg={priorityColor[t.priority]}>{t.priority}</Pill>
          <Pill border={false} bg="#eee">{t.status.replace("_", " ")}</Pill>
          {t.repeat !== "one-off" && <span style={{ fontFamily: mono, fontSize: 11, color: "#8a8a8a" }}>↻ {t.repeat}</span>}
          {cat && <Pill border={false} bg={cat.color}>{cat.name}</Pill>}
          {t.due_date && (
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: t.overdue ? RED : "#8a8a8a" }}>
              {t.overdue ? "⚠ " : ""}due {fmtDate(t.due_date)}
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(t.id)} style={{ width: 32, height: 32, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}>×</button>
    </div>
  );
}

function DashboardView({ tasks, categories, userName, openModal, refresh }) {
  const pending = tasks.filter(t => t.status === "pending").length;
  const done = tasks.filter(t => t.status === "done").length;
  const overdue = tasks.filter(t => t.overdue).length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const byPriority = { high: tasks.filter(t => t.priority === "high").length, medium: tasks.filter(t => t.priority === "medium").length, low: tasks.filter(t => t.priority === "low").length };

  const toggleDone = async (t) => {
    await api(`/tasks/${t.id}`, { method: "PUT", body: JSON.stringify({ status: t.status === "done" ? "pending" : "done" }) });
    refresh();
  };
  const del = async (id) => { await api(`/tasks/${id}`, { method: "DELETE" }); refresh(); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a6fd6" }}>HELLO, {userName.toUpperCase()}</div>
          <h1 style={{ fontFamily: display, fontSize: 42, margin: "4px 0 0", lineHeight: 1.05 }}>YOUR PLAN<br />FOR TODAY.</h1>
        </div>
        <button onClick={openModal} style={{ padding: "12px 18px", background: INK, color: "#fff", border: "none", fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer" }}>+ NEW TASK</button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total tasks" value={tasks.length} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Completed" value={done} bg={PURPLE} />
        <StatCard label="Overdue" value={overdue} bg={RED} />
        <StatCard label="Completion" value={completion + "%"} bg={YELLOW} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ padding: "14px 18px", borderBottom: `2px solid ${INK}` }}>
            <h3 style={{ margin: 0, fontFamily: display, fontSize: 15 }}>NEXT UP</h3>
          </div>
          {tasks.filter(t => t.status !== "done").length === 0 && <div style={{ padding: 18, color: "#8a8a8a", fontFamily: mono, fontSize: 13 }}>Nothing pending — nice work.</div>}
          {tasks.filter(t => t.status !== "done").map(t => <TaskListItem key={t.id} t={t} categories={categories} onToggleDone={toggleDone} onDelete={del} />)}
        </div>
        <div style={{ ...cardStyle, padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontFamily: display, fontSize: 15 }}>BY PRIORITY</h3>
          {["high", "medium", "low"].map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontFamily: mono, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
              <span style={{ width: 14, height: 14, background: priorityColor[p], border: `2px solid ${INK}`, display: "inline-block" }} />
              <span style={{ flex: 1 }}>{p}</span>
              <span>{byPriority[p]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TasksView({ tasks, categories, openModal, refresh }) {
  const [filter, setFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  let filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  if (projectFilter !== "all") filtered = filtered.filter(t => t.category_id === projectFilter);

  const toggleDone = async (t) => {
    await api(`/tasks/${t.id}`, { method: "PUT", body: JSON.stringify({ status: t.status === "done" ? "pending" : "done" }) });
    refresh();
  };
  const del = async (id) => { await api(`/tasks/${id}`, { method: "DELETE" }); refresh(); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a6fd6" }}>YOUR LIST</div>
          <h1 style={{ fontFamily: display, fontSize: 42, margin: "4px 0 0" }}>TASKS</h1>
        </div>
        <button onClick={openModal} style={{ padding: "12px 18px", background: INK, color: "#fff", border: "none", fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer" }}>+ NEW TASK</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", border: `2px solid ${INK}` }}>
          {["all", "pending", "in_progress", "done"].map((f, i) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 14px", border: "none", borderRight: i !== 3 ? `2px solid ${INK}` : "none",
              background: filter === f ? INK : "#fff", color: filter === f ? "#fff" : INK,
              fontFamily: mono, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer",
            }}>{f.replace("_", " ")}</button>
          ))}
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{ border: `2px solid ${INK}`, padding: "9px 10px", fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
          <option value="all">ALL PROJECTS</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={cardStyle}>
        {filtered.length === 0 && <div style={{ padding: 18, color: "#8a8a8a", fontFamily: mono, fontSize: 13 }}>No tasks here.</div>}
        {filtered.map(t => <TaskListItem key={t.id} t={t} categories={categories} onToggleDone={toggleDone} onDelete={del} />)}
      </div>
    </div>
  );
}

function CategoriesView({ categories, refresh }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api("/categories", { method: "POST", body: JSON.stringify({ name, color }) });
      setName("");
      refresh();
    } catch (err) { setError(err.message); }
  };
  const remove = async (id) => { await api(`/categories/${id}`, { method: "DELETE" }); refresh(); };

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a6fd6" }}>ORGANIZE</div>
      <h1 style={{ fontFamily: display, fontSize: 42, margin: "4px 0 24px" }}>PROJECTS</h1>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontFamily: display, fontSize: 16 }}>NEW PROJECT</h3>
          <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Marketing"
            style={{ width: "100%", border: `2px solid ${INK}`, padding: "10px 12px", margin: "6px 0 14px", fontFamily: "inherit", boxSizing: "border-box" }} />
          <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>COLOR</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "6px 0 18px" }}>
            {SWATCHES.map(s => (
              <button key={s} onClick={() => setColor(s)} style={{ height: 34, background: s, border: color === s ? `3px solid ${INK}` : `2px solid ${INK}`, cursor: "pointer" }} />
            ))}
          </div>
          {error && <div style={{ color: RED, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
          <button onClick={add} style={{ width: "100%", padding: "12px 0", background: INK, color: "#fff", border: "none", fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer" }}>+ ADD PROJECT</button>
        </div>

        <div style={cardStyle}>
          <div style={{ padding: "14px 18px", borderBottom: `2px solid ${INK}` }}>
            <h3 style={{ margin: 0, fontFamily: display, fontSize: 15 }}>ALL PROJECTS</h3>
          </div>
          {categories.length === 0 && <div style={{ padding: 18, color: "#8a8a8a", fontFamily: mono, fontSize: 13 }}>No projects yet.</div>}
          {categories.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: `2px solid ${INK}` }}>
              <div style={{ width: 26, height: 26, background: c.color, border: `2px solid ${INK}`, flexShrink: 0 }} />
              <div style={{ flex: 1, fontWeight: 700 }}>{c.name}</div>
              <button onClick={() => remove(c.id)} style={{ width: 32, height: 32, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamView({ categories }) {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [u, t] = await Promise.all([api("/admin/users"), api("/admin/tasks")]);
      setUsers(u); setTasks(t);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const allTotal = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const overdue = tasks.filter(t => t.overdue).length;
  const completion = allTotal ? Math.round((done / allTotal) * 100) : 0;

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a6fd6" }}>MANAGE TEAM</div>
      <h1 style={{ fontFamily: display, fontSize: 38, margin: "4px 0 20px", lineHeight: 1.05 }}>THE WHOLE<br />TEAM, AT ONCE.</h1>
      {error && <div style={{ color: RED, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Team size" value={users.length} />
        <StatCard label="All tasks" value={allTotal} />
        <StatCard label="Completed" value={done} bg={PURPLE} />
        <StatCard label="Overdue" value={overdue} bg={RED} />
        <StatCard label="Completion" value={completion + "%"} bg={YELLOW} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", borderBottom: `2px solid ${INK}` }}>
          <h3 style={{ margin: 0, fontFamily: display, fontSize: 15 }}>TEAM MEMBERS</h3>
        </div>
        {users.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: `2px solid ${INK}`, flexWrap: "wrap" }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 700, color: "#3b6fd6" }}>{u.name} {u.role === "admin" && <span style={{ color: "#8a6fd6", fontFamily: mono, fontSize: 10 }}> · admin</span>}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#8a8a8a" }}>{u.email}</div>
            </div>
            <div style={{ flex: 1, minWidth: 100, height: 8, background: "#eee", border: `1px solid ${INK}` }}>
              <div style={{ width: u.completion_rate + "%", height: "100%", background: PURPLE }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700 }}>{u.total} tasks · {u.done} done · {u.overdue} overdue</div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ padding: "14px 18px", borderBottom: `2px solid ${INK}` }}>
          <h3 style={{ margin: 0, fontFamily: display, fontSize: 15 }}>ALL TEAM TASKS</h3>
        </div>
        {tasks.map(t => {
          const cat = categories.find(c => c.id === t.category_id);
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `2px solid ${INK}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "#999" : INK }}>{t.title}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <Pill bg={priorityColor[t.priority]}>{t.priority}</Pill>
                  <Pill border={false} bg="#eee">{t.status.replace("_", " ")}</Pill>
                  {cat && <Pill border={false} bg={cat.color}>{cat.name}</Pill>}
                </div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: "#8a8a8a" }}>{t.owner_name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingsView() {
  const [meetings, setMeetings] = useState([]);
  const [status, setStatus] = useState({ connected: false, google_email: null });
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([api("/meetings"), api("/auth/google/status")]);
      setMeetings(m); setStatus(s);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    try {
      const { auth_url } = await api("/auth/google/connect");
      window.location.href = auth_url;
    } catch (e) { setError(e.message); }
  };

  const disconnect = async () => { await api("/auth/google/disconnect", { method: "POST" }); load(); };

  const createMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    try {
      await api("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title, start_time: `${date}T${startTime}:00`, end_time: `${date}T${endTime}:00`,
        }),
      });
      setTitle(""); setDate(""); setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const del = async (id) => { await api(`/meetings/${id}`, { method: "DELETE" }); load(); };

  const inputStyle = { width: "100%", border: `2px solid ${INK}`, padding: "9px 10px", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a6fd6" }}>SCHEDULE</div>
          <h1 style={{ fontFamily: display, fontSize: 42, margin: "4px 0 0" }}>MEETINGS</h1>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: "12px 18px", background: INK, color: "#fff", border: "none", fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer" }}>+ NEW MEETING</button>
      </div>

      <div style={{ ...cardStyle, padding: 18, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Google Calendar</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: "#8a8a8a", marginTop: 2 }}>
            {status.connected ? `Connected as ${status.google_email}` : "Not connected — meetings won't sync automatically"}
          </div>
        </div>
        {status.connected ? (
          <button onClick={disconnect} style={{ padding: "10px 16px", border: `2px solid ${INK}`, background: "#fff", fontFamily: mono, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>DISCONNECT</button>
        ) : (
          <button onClick={connect} style={{ padding: "10px 16px", border: "none", background: INK, color: "#fff", fontFamily: mono, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>CONNECT GOOGLE CALENDAR</button>
        )}
      </div>

      {error && <div style={{ color: RED, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {showForm && (
        <form onSubmit={createMeeting} style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
          <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>TITLE</label>
          <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly sync" style={{ ...inputStyle, margin: "6px 0 14px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>DATE</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>START</label>
              <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>END</label>
              <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px 0", border: `2px solid ${INK}`, background: "#fff", fontFamily: mono, fontWeight: 700, cursor: "pointer" }}>CANCEL</button>
            <button type="submit" style={{ flex: 1, padding: "12px 0", border: `2px solid ${INK}`, background: INK, color: "#fff", fontFamily: mono, fontWeight: 700, cursor: "pointer" }}>CREATE MEETING</button>
          </div>
        </form>
      )}

      <div style={cardStyle}>
        {meetings.length === 0 && <div style={{ padding: 18, color: "#8a8a8a", fontFamily: mono, fontSize: 13 }}>No meetings scheduled yet.</div>}
        {meetings.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `2px solid ${INK}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.title}</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: "#8a8a8a", marginTop: 4 }}>
                {m.start_time.replace("T", " ").slice(0, 16)} – {m.end_time.slice(11, 16)}
              </div>
            </div>
            {m.synced ? (
              <a href={m.google_event_link} target="_blank" rel="noreferrer">
                <Pill bg={MINT}>synced to google</Pill>
              </a>
            ) : (
              <Pill border={false} bg="#eee">not synced</Pill>
            )}
            <button onClick={() => del(m.id)} style={{ width: 32, height: 32, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(undefined);
  const [view, setView] = useState("dashboard");
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { api("/auth/me").then(setUser).catch(() => setUser(null)); }, []);

  const loadAll = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([api("/tasks"), api("/categories")]);
      setTasks(t); setCategories(c);
    } catch (e) { /* not logged in yet */ }
  }, []);
  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };

  if (user === undefined) return null;
  if (!user) return <AuthScreen onAuthed={setUser} />;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: "'Inter', sans-serif", backgroundImage: "radial-gradient(#d8d3c4 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
      {showModal && <NewTaskModal onClose={() => setShowModal(false)} categories={categories} onCreated={loadAll} />}

      <div style={{ background: "#fff", borderBottom: `2px solid ${INK}`, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Logo />
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <NavButton label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <NavButton label="Tasks" active={view === "tasks"} onClick={() => setView("tasks")} />
          <NavButton label="Categories" active={view === "categories"} onClick={() => setView("categories")} />
          <NavButton label="Meetings" active={view === "meetings"} onClick={() => setView("meetings")} />
          {user.role === "admin" && <NavButton label="Team" active={view === "team"} onClick={() => setView("team")} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: "#8a8a8a", letterSpacing: 0.5 }}>{user.role.toUpperCase()}</div>
          </div>
          <button onClick={logout} style={{ padding: "8px 12px", border: `2px solid ${INK}`, background: "#fff", fontFamily: mono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>SIGN OUT</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {view === "dashboard" && <DashboardView tasks={tasks} categories={categories} userName={user.name} openModal={() => setShowModal(true)} refresh={loadAll} />}
        {view === "tasks" && <TasksView tasks={tasks} categories={categories} openModal={() => setShowModal(true)} refresh={loadAll} />}
        {view === "categories" && <CategoriesView categories={categories} refresh={loadAll} />}
        {view === "meetings" && <MeetingsView />}
        {view === "team" && user.role === "admin" && <TeamView categories={categories} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
