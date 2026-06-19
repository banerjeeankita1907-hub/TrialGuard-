import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = auth.split(' ')[1]
  const githubRes = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } })
  if (!githubRes.ok) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const user = await githubRes.json()
  const login = user.login

  const userTrialsKey = `user:${login}:trials`
  const ids: string[] = (await kv.get(userTrialsKey)) || []
  if (ids.length === 0) return NextResponse.json({ trials: [] })

  const trials = await Promise.all(ids.map(id => kv.get(`trial:${id}`)))
  // Filter out any null values
  const validTrials = trials.filter(Boolean)
  return NextResponse.json({ trials: validTrials })
}
