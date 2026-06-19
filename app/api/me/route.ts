import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = auth.split(' ')[1]
  const githubRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${token}` },
  })
  if (!githubRes.ok) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  const user = await githubRes.json()
  return NextResponse.json({ login: user.login })
}
