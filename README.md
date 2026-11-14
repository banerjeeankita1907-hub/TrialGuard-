# TrialGuard — Free-trial reminder manager

TrialGuard is a Next.js application for recording subscription trial end dates
and emailing a reminder before renewal. Users authenticate with GitHub OAuth,
store a service name, reminder email and end date, and view their tracked
trials.

This release repairs the original OAuth callback flow and moves authentication
to a server-managed signed session cookie.

## Features

- GitHub OAuth sign-in with a one-time state cookie to mitigate login CSRF.
- GitHub access token exchange and profile verification occur only server-side.
- Signed HMAC application session in an `HttpOnly`, `SameSite=Lax` cookie.
- Browser JavaScript never receives or stores the GitHub access token.
- Session-protected APIs for adding, listing and identifying a user's trials.
- Input validation for service name, reminder email and ISO date.
- Daily cron endpoint with mandatory secret and UTC date comparison.
- Reminder records are marked as sent instead of being deleted from history.
- TypeScript type-check and production build in GitHub Actions.

## Local development

Requires Node.js 18.18 or newer.

```bash
npm install
cp .env.example .env.local
# Fill in the OAuth, session, KV and email values in .env.local.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required environment variables

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Server-side GitHub OAuth client secret |
| `GITHUB_REDIRECT_URI` | Exact registered callback URL |
| `SESSION_SECRET` | Random HMAC secret, minimum 32 UTF-8 bytes |
| `CRON_SECRET` | Secret for the scheduled reminder endpoint |
| `GMAIL_USER` | Reminder sender account |
| `GMAIL_APP_PASSWORD` | App-specific email password |
| Vercel KV credentials | Persistence for trials and user indexes |

See [.env.example](.env.example). Never commit real secrets or OAuth credentials.

## Authentication flow

1. The browser navigates to `/api/auth/login`.
2. The server creates a one-time random state value in a short-lived,
   HttpOnly cookie and redirects to GitHub OAuth.
3. The callback verifies the returned state, exchanges the authorization code
   and fetches the GitHub profile on the server.
4. The server discards the GitHub access token after identity verification and
   issues a signed application-session cookie.
5. `/api/me`, `/api/list-trials` and `/api/add-trial` validate that cookie.

No OAuth access token is returned in a URL, placed in browser storage or sent
from the browser to the application's API.

## Reminder workflow

The Vercel cron invokes `/api/cron` daily. It checks an explicitly configured
`CRON_SECRET`, compares date-only values in UTC, sends a reminder for trials
ending the following UTC day, and records `reminderSentAt`. Trial records stay
available for the user rather than being deleted after a reminder.

The cron uses Gmail SMTP through Nodemailer; delivery requires valid sender
credentials and provider permissions. It has not been connected to a live
mailbox from this repository update.

## Quality checks

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both checks for pushes and pull requests.

## Production considerations

The current KV list/index update is not transactional. Before a production
launch, add atomic writes or a relational data model, a reminder delivery
outbox with retries and deduplication, unsubscribe/deletion controls, retention
policies, audit logging and operational monitoring. Confirm the OAuth redirect
URI and the Vercel KV environment configuration in the deployment environment.

## Licence

No separate licence file is currently provided. Ask before reusing or
redistributing this repository's code.
