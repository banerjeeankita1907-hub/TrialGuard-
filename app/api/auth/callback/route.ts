import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  // Exchange code for access token
  const clientId = process.env.GITHUB_CLIENT_ID!
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  const data = await res.json()
  if (data.error) {
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url))
  }

  // Redirect to frontend with token in URL fragment
  return NextResponse.redirect(new URL(`/?access_token=${data.access_token}`, request.url))
}
