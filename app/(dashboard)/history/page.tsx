'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DailyLog {
  id: string
  date: string
  totalCaloriesLogged: number
  targetCalories: number | null
  mealCount: number
  isMock?: boolean
}

function makeMockLogs(): DailyLog[] {
  const base = 2100
  const targets = 2200
  const seeds = [
    { cal: 2060, meals: 4 }, { cal: 2180, meals: 5 }, { cal: 1850, meals: 3 },
    { cal: 2250, meals: 5 }, { cal: 2100, meals: 4 }, { cal: 1640, meals: 3 },
    { cal: 2320, meals: 5 }, { cal: 2150, meals: 4 }, { cal: 1920, meals: 4 },
    { cal: 2080, meals: 5 }, { cal: 2280, meals: 5 }, { cal: 1780, meals: 3 },
    { cal: 2190, meals: 4 }, { cal: 2050, meals: 4 },
  ]
  return seeds.map((s, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (i + 1))
    d.setHours(0, 0, 0, 0)
    return {
      id: `mock-${i}`,
      date: d.toISOString(),
      totalCaloriesLogged: s.cal,
      targetCalories: targets,
      mealCount: s.meals,
      isMock: true,
    }
  })
}

function AdherenceBadge({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#4CAF7D' : pct >= 60 ? '#F5A623' : '#E05A5A'
  const label = pct >= 85 ? 'On track' : pct >= 60 ? 'Partial' : 'Off track'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '2px 8px', borderRadius: 8 }}>{label}</span>
  )
}

function WeeklySummary({ logs }: { logs: DailyLog[] }) {
  const last7 = logs.slice(0, 7)
  const avgPct = last7.length
    ? Math.round(last7.reduce((s, l) => s + (l.targetCalories ? (l.totalCaloriesLogged / l.targetCalories) * 100 : 0), 0) / last7.length)
    : 0
  const onTrackDays = last7.filter(l => l.targetCalories && (l.totalCaloriesLogged / l.targetCalories) >= 0.85).length
  const streak = (() => {
    let s = 0
    for (const l of logs) {
      if (l.targetCalories && (l.totalCaloriesLogged / l.targetCalories) >= 0.85) s++
      else break
    }
    return s
  })()

  const barsData = last7.slice().reverse()

  return (
    <div className="card" style={{ padding: 20, marginBottom: 8 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Last 7 days</h2>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: 'Avg adherence', value: `${avgPct}%`, color: avgPct >= 85 ? '#4CAF7D' : avgPct >= 60 ? '#F5A623' : '#E05A5A' },
          { label: 'On-track days', value: `${onTrackDays} / ${last7.length}`, color: 'var(--primary)' },
          { label: 'Current streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, color: '#9B59B6' },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48 }}>
        {barsData.map((l, i) => {
          const pct = l.targetCalories ? Math.min(100, Math.round((l.totalCaloriesLogged / l.targetCalories) * 100)) : 0
          const color = pct >= 85 ? '#4CAF7D' : pct >= 60 ? '#F5A623' : '#E05A5A'
          const day = new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short' })
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', borderRadius: 4, background: color, height: `${Math.max(8, pct * 0.44)}px`, transition: 'height 0.3s ease' }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{day}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isMockData, setIsMockData] = useState(false)

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => {
        const real = d.logs ?? []
        if (real.length === 0) {
          setLogs(makeMockLogs())
          setIsMockData(true)
        } else {
          setLogs(real)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>History</h1>
          {isMockData && (
            <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(232,148,58,0.12)', color: 'var(--accent)', padding: '2px 10px', borderRadius: 8, border: '1px solid rgba(232,148,58,0.3)' }}>
              Sample data
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {isMockData ? 'Start logging meals to see your real history.' : 'Your daily adherence over time.'}
        </p>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20, height: 72, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <WeeklySummary logs={logs} />

          {isMockData && (
            <div style={{ background: 'rgba(232,148,58,0.08)', border: '1px solid rgba(232,148,58,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>📸</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8B5200' }}>Showing sample data</div>
                <div style={{ fontSize: 12, color: '#8B5200', marginTop: 2 }}>
                  Log your first meal to replace this with your real history.{' '}
                  <Link href="/log" style={{ color: 'var(--primary)', fontWeight: 700 }}>Log now →</Link>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Daily logs</h2>
            {logs.map(log => {
              const pct = log.targetCalories ? Math.round((log.totalCaloriesLogged / log.targetCalories) * 100) : 0
              const color = pct >= 85 ? '#4CAF7D' : pct >= 60 ? '#F5A623' : '#E05A5A'
              const date = new Date(log.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
              const isExpanded = expanded === log.id
              return (
                <div key={log.id} className="card" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setExpanded(isExpanded ? null : log.id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 18 }}>{pct >= 85 ? '✅' : pct >= 60 ? '⚡' : '💧'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{date}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{log.mealCount} meal{log.mealCount !== 1 ? 's' : ''} logged</div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 8, flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color }}>{log.totalCaloriesLogged} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>kcal</span></div>
                      <AdherenceBadge pct={pct} />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Target', value: `${log.targetCalories ?? '—'} kcal` },
                          { label: 'Logged', value: `${log.totalCaloriesLogged} kcal` },
                          { label: 'Adherence', value: `${pct}%`, color },
                        ].map(s => (
                          <div key={s.label}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: s.color ?? 'var(--text)' }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
