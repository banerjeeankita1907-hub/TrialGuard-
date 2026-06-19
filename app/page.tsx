'use client'

import { useState, useEffect, FormEvent } from 'react'

const CLIENT_ID = 'YOUR_GITHUB_OAUTH_CLIENT_ID' // Replace this
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin + '/api/auth/callback' : ''

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<string | null>(null)
  const [trials, setTrials] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [service, setService] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('trialguard_token')
    if (stored) {
      setToken(stored)
      fetchUser(stored)
      fetchTrials(stored)
    }
  }, [])

  const fetchUser = async (tok: string) => {
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${tok}` } })
    if (res.ok) {
      const data = await res.json()
      setUser(data.login)
    } else {
      localStorage.removeItem('trialguard_token')
      setToken(null)
    }
  }

  const fetchTrials = async (tok: string) => {
    const res = await fetch('/api/list-trials', { headers: { Authorization: `Bearer ${tok}` } })
    if (res.ok) {
      const data = await res.json()
      setTrials(data.trials || [])
    }
  }

  const addTrial = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) return
    const res = await fetch('/api/add-trial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, service, endDate }),
    })
    if (res.ok) {
      setEmail('')
      setService('')
      setEndDate('')
      fetchTrials(token)
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
    }
  }

  const login = () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=read:user`
    window.location.href = authUrl
  }

  const logout = () => {
    localStorage.removeItem('trialguard_token')
    setToken(null)
    setUser(null)
    setTrials([])
  }

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 400, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <h1>🛡️ TrialGuard</h1>
          <p style={{ color: '#555' }}>Never pay for a forgotten free trial again.</p>
          <button onClick={login} style={{ background: '#2ea44f', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
            Sign in with GitHub
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>🛡️ TrialGuard</h1>
          <button onClick={logout} style={{ background: '#eee', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>Logout</button>
        </div>
        {user && <p>Signed in as <strong>{user}</strong></p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={addTrial} style={{ marginTop: 20 }}>
          <input type="email" placeholder="Your email for reminder" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Service (e.g., Netflix)" value={service} onChange={e => setService(e.target.value)} required style={inputStyle} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={inputStyle} />
          <button type="submit" style={{ width: '100%', background: '#2ea44f', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>Add Trial</button>
        </form>
        <h3 style={{ marginTop: 30 }}>Your Active Trials</h3>
        {trials.length === 0 ? (
          <p style={{ color: '#888' }}>No trials tracked yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {trials.map((t: any) => (
              <li key={t.id} style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{t.service}</strong> – ends {t.endDate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: 12,
  marginBottom: 12,
  border: '1px solid #d0d7de',
  borderRadius: 8,
  fontSize: 16,
  boxSizing: 'border-box' as any,
}
