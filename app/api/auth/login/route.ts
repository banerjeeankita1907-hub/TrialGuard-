import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const OAUTH_STATE_COOKIE = "trialguard_oauth_state";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth is not configured" }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const callbackUrl = process.env.GITHUB_REDIRECT_URI
    || new URL("/api/auth/callback", request.url).toString();
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
