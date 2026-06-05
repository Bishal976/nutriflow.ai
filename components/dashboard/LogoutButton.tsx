'use client'

export default function LogoutButton() {
  return (
    <button
      className="btn-secondary"
      style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)' }}
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
      }}
    >
      Sign out
    </button>
  )
}
