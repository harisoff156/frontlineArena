import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leaderboard } from "@/db/schema";

export const dynamic = "force-dynamic";

const clampStr = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.slice(0, max) || fallback : fallback;
const clampInt = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;

export async function GET() {
  try {
    const rows = await db
      .select({
        id: leaderboard.id,
        name: leaderboard.name,
        mode: leaderboard.mode,
        map: leaderboard.map,
        kills: leaderboard.kills,
        score: leaderboard.score,
        rating: leaderboard.rating,
        createdAt: leaderboard.createdAt,
      })
      .from(leaderboard)
      .orderBy(desc(leaderboard.score))
      .limit(30);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ ok: false, rows: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await db.insert(leaderboard).values({
      name: clampStr(body.name, 24, "Игрок"),
      mode: clampStr(body.mode, 24, "tdm"),
      map: clampStr(body.map, 24, "city"),
      kills: clampInt(body.kills, 999),
      score: clampInt(body.score, 999999),
      rating: clampInt(body.rating, 9999),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
