# TrialGuard authentication and reminder design

## OAuth and session lifecycle

The browser begins sign-in by requesting `GET /api/auth/login`. The server
generates 256 bits of random state and stores it in a short-lived HttpOnly,
SameSite=Lax cookie. GitHub returns the same state to
`GET /api/auth/callback`; the callback rejects missing or mismatched state
before exchanging the authorization code.

The GitHub access token is used server-side only to fetch the authenticated
GitHub profile. The app then creates a compact HMAC-SHA256 session containing
the GitHub login, issue time and expiry. The token is stored in a Secure
(production), HttpOnly, SameSite=Lax cookie with a seven-day lifetime.

The application session uses `SESSION_SECRET`, which must be at least 32
UTF-8 bytes. GitHub OAuth uses `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`. These secrets must remain server-side.

The session cookie is validated on each authenticated API request. The browser
does not receive the provider access token and no provider token is stored in
localStorage.

## Trial record validation

A trial request must contain:
- A valid email address up to 254 characters.
- A trimmed service name from 1 to 100 printable characters.
- A valid calendar date encoded as `YYYY-MM-DD`.

Each record is associated with the login from the validated session, not a
client-supplied user ID. List retrieval filters records against that same
identity.

## Scheduled reminders

The cron endpoint fails closed when `CRON_SECRET` is absent or incorrect.
Date-only trial values are compared using UTC. The job records
`reminderSentAt` after sending and retains the trial record for the user.

The job is not yet backed by a transactional outbox. If email delivery succeeds
but the following KV write fails, a later run could send a duplicate. A
production implementation should use a durable delivery state machine,
deduplication key and retry policy.

## Deployment checklist

1. Register the exact callback URL `https://YOUR_DOMAIN/api/auth/callback`
   with the GitHub OAuth App.
2. Configure the OAuth client ID and secret in the hosting environment.
3. Set a unique random `SESSION_SECRET` of at least 32 UTF-8 bytes.
4. Configure Vercel KV credentials and verify read/write permissions.
5. Set a unique `CRON_SECRET`, Gmail sender and app-specific password.
6. Confirm the cron schedule and UTC date behavior for target users.
7. Set HTTPS in production so the session cookie receives the Secure flag.
8. Test login, logout, expired sessions, invalid state, add/list and reminder
   delivery in a staging environment.

## Remaining production work

The current KV index update is a read-modify-write sequence and can lose an
update under concurrent submissions. Reminder delivery is not transactional.
The app also needs retention/deletion controls, notification preferences,
verified email ownership, a tested resend policy and monitoring. A GitHub
account authenticates the user but does not establish that the user controls
the reminder email address.
