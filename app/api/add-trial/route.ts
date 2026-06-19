import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = auth.split(' ')[1]
  const githubRes = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } })
  if (!githubRes.ok) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const user = await githubRes.json()
  const login = user.login

  const { email, service, endDate } = await req.json()
  if (!email || !service || !endDate) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const trialId = randomUUID()
  const trial = { id: trialId, email, service, endDate, userId: login }

  // Store trial object
  await kv.set(`trial:${trialId}`, trial)

  // Add to user's trial list
  const userTrialsKey = `user:${login}:trials`
  const currentIds: string[] = (await kv.get(userTrialsKey)) || []
  currentIds.push(trialId)
  await kv.set(userTrialsKey, currentIds)

  // Track user in global set (for cron)
  const allUsers: string[] = (await kv.get('all_users')) || []
  if (!allUsers.includes(login)) {
    allUsers.push(login)
    await kv.set('all_users', allUsers)
  }

  return NextResponse.json({ success: true, trial })
}
