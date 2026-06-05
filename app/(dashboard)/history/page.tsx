export default function HistoryPage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>History</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Your logged meals and adherence trends over time.</p>
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Historical trend charts and weekly summaries are coming in Phase 2. Log your first meal to start building your history.</p>
      </div>
    </div>
  )
}
