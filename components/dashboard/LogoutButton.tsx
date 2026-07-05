'use client'
import { useState } from 'react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)
  return (
    <button
      className="btn-secondary"
      disabled={loading}
      style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)', opacity: loading ? 0.6 : 1 }}
      onClick={async () => {
        setLoading(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
      }}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
