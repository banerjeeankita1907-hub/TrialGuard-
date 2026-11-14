import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const storedIds = await kv.get(`user:${session.login}:trials`);
    const ids: string[] = Array.isArray(storedIds)
      ? storedIds.filter((id): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { trials: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const records = await Promise.all(ids.slice(0, 500).map((id) => kv.get(`trial:${id}`)));
    const trials = records.filter((trial): trial is Record<string, unknown> =>
      Boolean(trial)
      && typeof trial === "object"
      && (trial as Record<string, unknown>).userId === session.login
    );
    return NextResponse.json(
      { trials },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Trial list failed:", error);
    return NextResponse.json({ error: "Could not load trials" }, { status: 500 });
  }
}
