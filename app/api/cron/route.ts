import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import nodemailer from "nodemailer";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mailUser = process.env.GMAIL_USER;
  const mailPassword = process.env.GMAIL_APP_PASSWORD;
  if (!mailUser || !mailPassword) {
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  }

  // Trial dates are date-only values; compare them using UTC consistently.
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  ));
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  try {
    const storedUsers = await kv.get("all_users");
    const allUsers: string[] = Array.isArray(storedUsers)
      ? storedUsers.filter((login): login is string => typeof login === "string")
      : [];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: mailUser, pass: mailPassword },
    });

    let remindersSent = 0;
    let failures = 0;
    for (const login of allUsers) {
      const storedIds = await kv.get(`user:${login}:trials`);
      const ids: string[] = Array.isArray(storedIds)
        ? storedIds.filter((id): id is string => typeof id === "string")
        : [];

      for (const id of ids.slice(0, 500)) {
        const trial = await kv.get(`trial:${id}`) as Record<string, unknown> | null;
        if (
          !trial ||
          trial.userId !== login ||
          trial.endDate !== tomorrowStr ||
          typeof trial.reminderSentAt === "string"
        ) continue;

        if (typeof trial.email !== "string" || typeof trial.service !== "string") {
          failures += 1;
          continue;
        }

        try {
          await transporter.sendMail({
            from: mailUser,
            to: trial.email,
            subject: `Reminder: Your ${trial.service} trial ends tomorrow`,
            text: [
              "Hello,",
              "",
              `Your free trial for ${trial.service} ends on ${tomorrowStr}.`,
              "Review the service's cancellation terms if you do not want it to renew.",
              "",
              "Tracked by TrialGuard.",
            ].join("\n"),
          });

          // Keep the record for the user; mark it as reminded instead of deleting it.
          await kv.set(`trial:${id}`, {
            ...trial,
            reminderSentAt: new Date().toISOString(),
          });
          remindersSent += 1;
        } catch (error) {
          failures += 1;
          console.error("Trial reminder failed:", { trialId: id, error });
        }
      }
    }

    return NextResponse.json(
      { success: true, remindersSent, failures, dateChecked: tomorrowStr },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Trial reminder job failed:", error);
    return NextResponse.json({ error: "Reminder job failed" }, { status: 500 });
  }
}
