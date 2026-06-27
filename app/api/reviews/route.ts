import { NextResponse } from "next/server";
import { getPool, hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

// Community (parent/student) reviews — user-generated, stored in their own table
// so they survive data reloads (load_postgres.py never drops school_reviews).
async function ensureTable() {
  const pool = getPool();
  await pool.query(`
    create table if not exists school_reviews (
      id          bigserial primary key,
      nces_id     text not null,
      rating      integer not null check (rating between 1 and 5),
      author      text,
      role        text,
      comment     text,
      created_at  timestamptz not null default now()
    );
    create index if not exists school_reviews_nces_idx on school_reviews (nces_id);
  `);
}

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ reviews: [], average: null, count: 0 });
  const { searchParams } = new URL(request.url);
  const ncesId = (searchParams.get("ncesId") ?? "").trim();
  if (!ncesId) return NextResponse.json({ error: "Provide ?ncesId=" }, { status: 400 });
  try {
    await ensureTable();
    const pool = getPool();
    const res = await pool.query(
      `select id, rating, author, role, comment, created_at
         from school_reviews where nces_id = $1
        order by created_at desc limit 100`,
      [ncesId]
    );
    const ratings = res.rows.map((r) => r.rating);
    const average = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
    return NextResponse.json({ reviews: res.rows, average, count: ratings.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load reviews." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Reviews require the database." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const ncesId = String(body.ncesId ?? "").trim();
    const rating = Number(body.rating);
    const author = String(body.author ?? "").trim().slice(0, 80) || "Anonymous";
    const role = ["parent", "student", "community", "teacher"].includes(body.role)
      ? body.role
      : "community";
    const comment = String(body.comment ?? "").trim().slice(0, 2000);
    if (!ncesId) return NextResponse.json({ error: "Missing school." }, { status: 400 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1–5." }, { status: 400 });
    }
    if (comment.length < 3) {
      return NextResponse.json({ error: "Please write a short comment." }, { status: 400 });
    }
    await ensureTable();
    const pool = getPool();
    await pool.query(
      `insert into school_reviews (nces_id, rating, author, role, comment) values ($1,$2,$3,$4,$5)`,
      [ncesId, rating, author, role, comment]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not save review." }, { status: 500 });
  }
}
