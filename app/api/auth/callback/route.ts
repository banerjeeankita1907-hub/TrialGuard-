import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const OAUTH_STATE_COOKIE = "trialguard_oauth_state";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function redirectWithError(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL("/?error=" + encodeURIComponent(code), request.url));
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const receivedState = searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !receivedState || !expectedState || !safeEqual(receivedState, expectedState)) {
    return redirectWithError(request, "oauth_state_invalid");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError(request, "oauth_not_configured");
  }

  const callbackUrl = process.env.GITHUB_REDIRECT_URI
    || new URL("/api/auth/callback", request.url).toString();

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) return redirectWithError(request, "oauth_exchange_failed");
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token || tokenData.error) {
      return redirectWithError(request, "oauth_exchange_failed");
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: "Bearer " + tokenData.access_token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!userResponse.ok) return redirectWithError(request, "github_profile_failed");
    const user = await userResponse.json() as { login?: string };
    if (!user.login || !/^[A-Za-z0-9-]{1,39}$/.test(user.login)) {
      return redirectWithError(request, "github_profile_invalid");
    }

    // The GitHub access token is used only on the server to verify identity.
    // It is never placed in a URL, returned to the browser, or stored in JS.
    const session = createSession(user.login);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return redirectWithError(request, "oauth_callback_failed");
  }
}
