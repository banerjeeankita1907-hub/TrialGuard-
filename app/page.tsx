"use client";

import { useState, useEffect, FormEvent } from "react";

type Trial = {
  id: string;
  service: string;
  email: string;
  endDate: string;
  createdAt?: string;
};

export default function Home() {
  const [user, setUser] = useState<string | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTrials = async () => {
    const response = await fetch("/api/list-trials", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : "Could not load trials.");
    }
    const data = await response.json() as { trials?: Trial[] };
    setTrials(Array.isArray(data.trials) ? data.trials : []);
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      if (oauthError && active) {
        setError("GitHub sign-in could not be completed (" + oauthError + "). Please try again.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      try {
        const response = await fetch("/api/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) setUser(null);
          return;
        }
        const data = await response.json() as { login?: string };
        if (active && data.login) {
          setUser(data.login);
          await fetchTrials();
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not restore your session.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, []);

  const login = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setUser(null);
      setTrials([]);
    }
  };

  const addTrial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!user || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/add-trial", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, service, endDate }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add the trial.");
      setEmail("");
      setService("");
      setEndDate("");
      await fetchTrials();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", color: "#334155" }}>
        Checking your secure session…
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: 20 }}>
        <section style={{ background: "white", borderRadius: 16, padding: 40, width: "100%", maxWidth: 420, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
          <h1>🛡️ TrialGuard</h1>
          <p style={{ color: "#555" }}>Never pay for a forgotten free trial again.</p>
          {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
          <button onClick={login} style={{ background: "#2ea44f", color: "white", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
            Sign in with GitHub
          </button>
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 18 }}>
            TrialGuard uses a server-managed secure session. Your GitHub access token is not stored in browser local storage.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 20 }}>
      <section style={{ background: "white", borderRadius: 16, padding: 30, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1>🛡️ TrialGuard</h1>
          <button onClick={logout} style={{ background: "#eee", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Logout</button>
        </div>
        <p>Signed in as <strong>{user}</strong></p>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <form onSubmit={addTrial} style={{ marginTop: 20 }}>
          <label style={labelStyle}>Reminder email</label>
          <input type="email" placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} style={inputStyle} />
          <label style={labelStyle}>Service</label>
          <input type="text" placeholder="e.g. Streaming service" value={service} onChange={event => setService(event.target.value)} required maxLength={100} style={inputStyle} />
          <label style={labelStyle}>Trial end date</label>
          <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} required min={new Date().toISOString().slice(0, 10)} style={inputStyle} />
          <button type="submit" disabled={saving} style={{ width: "100%", background: saving ? "#9ca3af" : "#2ea44f", color: "white", border: "none", padding: 12, borderRadius: 8, fontSize: 16, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Saving…" : "Add Trial"}
          </button>
        </form>
        <h3 style={{ marginTop: 30 }}>Your Tracked Trials</h3>
        {trials.length === 0 ? (
          <p style={{ color: "#888" }}>No trials tracked yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {trials.map(trial => (
              <li key={trial.id} style={{ background: "#f6f8fa", padding: 12, borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span><strong>{trial.service}</strong><br /><small>{trial.email}</small></span>
                <span>Ends {trial.endDate}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  border: "1px solid #d0d7de",
  borderRadius: 8,
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  color: "#334155",
  fontSize: 14,
  fontWeight: 600 as const,
};
