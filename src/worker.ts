import { Hono } from "hono";
import { handle } from "hono-next";

const app = new Hono();

// API routes
app.get("/api/events", async (c) => {
  const db = c.env?.DB;
  const month = c.req.query("month");

  if (!db || !month) {
    return c.json({ error: "Missing parameters" }, 400);
  }

  const [year, monthNum] = month.split("-");
  const startDate = new Date(Number(year), Number(monthNum) - 1, 1)
    .toISOString()
    .split("T")[0];
  const endDate = new Date(Number(year), Number(monthNum), 0)
    .toISOString()
    .split("T")[0];

  const events = await db
    .prepare(
      "SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, startTime"
    )
    .bind(startDate, endDate)
    .all();

  return c.json(events.results || []);
});

app.post("/api/events", async (c) => {
  const db = c.env?.DB;
  const body = await c.req.json();
  const { title, date, startTime, endTime, createdBy } = body;

  if (!db || !title || !date) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO events (id, title, date, startTime, endTime, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, title, date, startTime || null, endTime || null, createdBy, now, now)
    .run();

  return c.json({ id, title, date, startTime, endTime, createdBy }, 201);
});

app.put("/api/events/:id", async (c) => {
  const db = c.env?.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { title, date, startTime, endTime } = body;

  if (!db || !id) {
    return c.json({ error: "Invalid request" }, 400);
  }

  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE events SET title = ?, date = ?, startTime = ?, endTime = ?, updatedAt = ? WHERE id = ?"
    )
    .bind(title, date, startTime || null, endTime || null, now, id)
    .run();

  return c.json({ success: true });
});

app.delete("/api/events/:id", async (c) => {
  const db = c.env?.DB;
  const id = c.req.param("id");

  if (!db || !id) {
    return c.json({ error: "Invalid request" }, 400);
  }

  await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

export default handle(app);
