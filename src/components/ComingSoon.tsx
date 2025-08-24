import React, { useEffect, useState } from 'react'

type Status = 'idle' | 'sending' | 'ok' | 'error'

export default function ComingSoon() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 })

  // Deployed Apps Script Web App URL (use the one provided by the user)
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzx0ASmUW_L35pFEUpnK0bxFPFleRefOVGSaaQiHFjGng_9ur8I4ZkptcsU_lFOVq29/exec'

  // Client-side rate limit / cooldown settings
  const RATE_LIMIT_WINDOW = 1000 * 60 * 60 // 1 hour window
  const MAX_SUBMISSIONS_PER_WINDOW = 5
  const COOLDOWN_AFTER_SUCCESS_MS = 1000 * 60 // 60 seconds cooldown after a successful submit
  const STORAGE_KEY = 'comingSoon:submissions'

  useEffect(() => {
    const target = new Date('2025-09-24T09:00:00+07:00').getTime() // Jakarta time (UTC+7)

    function update() {
      const now = Date.now()
      let diff = target - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 })
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      diff -= days * 1000 * 60 * 60 * 24
      const hours = Math.floor(diff / (1000 * 60 * 60))
      diff -= hours * 1000 * 60 * 60
      const mins = Math.floor(diff / (1000 * 60))
      diff -= mins * 1000 * 60
      const secs = Math.floor(diff / 1000)
      setTimeLeft({ days, hours, mins, secs })
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // simple helper: read timestamps array from localStorage
  function readSubmissionTimestamps(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map((n) => Number(n)).filter(Boolean)
    } catch {
      return []
    }
  }

  // write timestamps array
  function writeSubmissionTimestamps(timestamps: number[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps))
    } catch {
      // ignore storage errors
    }
  }

  function canSubmitNow(): { ok: boolean; reason?: string } {
    const now = Date.now()
    const timestamps = readSubmissionTimestamps().filter((t) => now - t <= RATE_LIMIT_WINDOW)
    if (timestamps.length >= MAX_SUBMISSIONS_PER_WINDOW) {
      return { ok: false, reason: `Rate limit exceeded. Try again later.` }
    }
    const last = timestamps[timestamps.length - 1]
    if (last && now - last < COOLDOWN_AFTER_SUCCESS_MS) {
      const wait = Math.ceil((COOLDOWN_AFTER_SUCCESS_MS - (now - last)) / 1000)
      return { ok: false, reason: `Please wait ${wait}s before sending again.` }
    }
    return { ok: true }
  }

  // debounce guard to avoid accidental double clicks in quick succession
  const lastCallRef = React.useRef(0)
  const DEBOUNCE_MS = 800

  async function handleNotify(e?: React.FormEvent) {
    e?.preventDefault()
    setMessage(null)

    // debounce guard
    const now = Date.now()
    if (now - lastCallRef.current < DEBOUNCE_MS) return
    lastCallRef.current = now

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }

    const allowed = canSubmitNow()
    if (!allowed.ok) {
      setStatus('error')
      setMessage(allowed.reason ?? null)
      return
    }

    setStatus('sending')
    try {
      // Use URLSearchParams so the request is a simple POST (no preflight/CORS OPTIONS)
      const body = new URLSearchParams({ email })
      const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        body,
      })
      // Apps Script returns JSON like {ok: true}; tolerate non-JSON by falling back to res.ok
      const data = await res.json().catch(() => ({ ok: res.ok }))
      if (data && data.ok) {
        setStatus('ok')
        setMessage('Thanks — we will notify you!')
        setEmail('')
        // record timestamp
        const timestamps = readSubmissionTimestamps().filter((t) => now - t <= RATE_LIMIT_WINDOW)
        timestamps.push(now)
        writeSubmissionTimestamps(timestamps)
      } else {
        setStatus('error')
        setMessage(data && data.error ? String(data.error) : 'Submission failed. Please try again later.')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message || 'Network error')
    } finally {
      // return to idle after a short delay so button re-enables
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-600 to-purple-600 flex items-center justify-center p-6">
      <div className="max-w-xl text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-white/20">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2">Coming Soon</h1>

        <div className="text-white/90 mb-4">
          <div className="text-sm">Launch date</div>
          <div className="text-2xl font-semibold">
            {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.mins).padStart(2, '0')}m {String(timeLeft.secs).padStart(2, '0')}s
          </div>
        </div>

        <p className="text-white/90 mb-6">We're working hard to bring something amazing. Stay tuned — launch is coming soon.</p>

        <form className="flex justify-center gap-2" onSubmit={handleNotify} aria-live="polite">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-2 rounded-md border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="Enter your email"
            aria-label="Email address"
            type="email"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="px-4 py-2 rounded-md bg-white text-sky-700 font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Notify Me'}
          </button>
        </form>

        <div className="mt-4 h-6">
          {message && (
            <p className={`text-sm ${status === 'ok' ? 'text-green-200' : 'text-red-200'}`}>{message}</p>
          )}
        </div>

        <p className="mt-6 text-sm text-white/70">Follow us</p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <a
            href="https://instagram.com/langkahliarid"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-white/90 hover:opacity-90"
            aria-label="Instagram - langkahliarid"
          >
            <i className="fa-brands fa-instagram w-5 h-5" aria-hidden="true" />
            <span className="font-medium">langkahliarid</span>
          </a>

          <a
            href="https://www.youtube.com/@langkahliarid"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-white/90 hover:opacity-90"
            aria-label="YouTube - langkahliarid"
          >
            <i className="fa-brands fa-youtube w-5 h-5" aria-hidden="true" />
            <span className="font-medium">langkahliarid</span>
          </a>
        </div>
      </div>
    </div>
  )
}
