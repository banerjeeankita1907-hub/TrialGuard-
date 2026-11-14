import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

function validEmail(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const service = typeof body.service === "string" ? body.service.trim() : "";
  const endDate = body.endDate;

  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid reminder email address" }, { status: 400 });
  }
  if (!service || service.length > 100 || /[\r\n\u0000-\u001f]/.test(service)) {
    return NextResponse.json({ error: "Service name must be 1-100 printable characters" }, { status: 400 });
  }
  if (!validDate(endDate)) {
    return NextResponse.json({ error: "End date must be a valid YYYY-MM-DD date" }, { status: 400 });
  }

  try {
    const trialId = randomUUID();
    const trial = {
      id: trialId,
      email,
      service,
      endDate,
      userId: session.login,
      createdAt: new Date().toISOString(),
    };

    const userTrialsKey = `user:${session.login}:trials`;
    const storedIds = await kv.get(userTrialsKey);
    const currentIds: string[] = Array.isArray(storedIds)
      ? storedIds.filter((id): id is string => typeof id === "string")
      : [];
    if (currentIds.length >= 500) {
      return NextResponse.json({ error: "Trial limit reached for this account" }, { status: 429 });
    }

    await kv.set(`trial:${trialId}`, trial);
    await kv.set(userTrialsKey, [...currentIds, trialId]);

    const storedUsers = await kv.get("all_users");
    const users: string[] = Array.isArray(storedUsers)
      ? storedUsers.filter((login): login is string => typeof login === "string")
      : [];
    if (!users.includes(session.login)) {
      await kv.set("all_users", [...users, session.login]);
    }

    return NextResponse.json(
      { success: true, trial },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Trial save failed:", error);
    return NextResponse.json({ error: "Could not save the trial" }, { status: 500 });
  }
}
