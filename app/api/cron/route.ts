import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import nodemailer from 'nodemailer'

export async function GET(req: NextRequest) {
  // Verify cron secret (optional, but recommended)
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD

  const allUsers: string[] = (await kv.get('all_users')) || []
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  for (const login of allUsers) {
    const ids: string[] = (await kv.get(`user:${login}:trials`)) || []
    for (const id of ids) {
      const trial: any = await kv.get(`trial:${id}`)
      if (!trial) continue
      if (trial.endDate === tomorrowStr) {
        // Send email
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: trial.email,
          subject: `Reminder: Your ${trial.service} trial ends tomorrow`,
          text: `Hi,\n\nYour free trial for ${trial.service} ends on ${trial.endDate}. Cancel before then if you don't want to be charged.\n\nTracked by TrialGuard.`,
        })
        // Remove trial after reminder
        await kv.del(`trial:${id}`)
        // Remove from user's list
        const updatedIds = ids.filter(i => i !== id)
        await kv.set(`user:${login}:trials`, updatedIds)
      }
    }
  }

  return NextResponse.json({ success: true, remindersSent: 'processed' })
}
