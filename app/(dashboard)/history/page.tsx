'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdherenceHeatmap from '@/components/history/AdherenceHeatmap'

interface DailyLog {
  id: string
  date: string
  totalCaloriesLogged: number
  targetCalories: number | null
  mealCount: number
  isMock?: boolean
}
interface DaySummary { date: string; totalCaloriesLogged: number; targetCalories: number | null }

// Simulates ~3 months of daily logging — lets us see how the history page holds up
// for a long-tenured user (list length, heatmap density, grouping, etc.)
function makeMockLogs(): DailyLog[] {
  const targets = 2200
  const days = 92
  let seed = 1337
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const logs: DailyLog[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (i + 1))
    d.setHours(0, 0, 0, 0)

    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    // Slight improving trend the closer to today (recent days = better adherence)
    const trendBoost = (1 - i / days) * 120
    const variance = (rand() - 0.5) * (isWeekend ? 760 : 480)
    const offDayRoll = rand()

    let cal: number
    let meals: number
    if (offDayRoll < 0.07) {
      // occasional off day — under-logged or skipped meals
      cal = Math.round(targets * (0.45 + rand() * 0.25))
      meals = 1 + Math.round(rand() * 2)
    } else {
      cal = Math.round(targets + trendBoost + variance)
      meals = 3 + Math.round(rand() * 2)
    }

    logs.push({
      id: `mock-${i}`,
      date: d.toISOString(),
      totalCaloriesLogged: Math.max(600, cal),
      targetCalories: targets,
      mealCount: meals,
      isMock: true,
    })
  }
  return logs
}

function groupByMonth(logs: DailyLog[]) {
  const order: string[] = []
  const groups = new Map<string, { label: string; logs: DailyLog[] }>()
  for (const log of logs) {
    const d = new Date(log.date)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (!groups.has(key)) {
      groups.set(key, { label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), logs: [] })
      order.push(key)
    }
    groups.get(key)!.logs.push(log)
  }
  return order.map(key => ({ key, ...groups.get(key)! }))
}

function adherenceColor(pct: number) {
  return pct >= 85 ? '#4CAF7D' : pct >= 60 ? '#F5A623' : '#E05A5A'
}

function AdherenceBadge({ pct }: { pct: number }) {
  const color = adherenceColor(pct)
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

  // Always render exactly 7 fixed day-slots (today back to 6 days ago) so the chart
  // keeps a consistent shape — days without a log show as a muted placeholder instead
  // of letting `flex: 1` stretch the few real bars into oversized, uneven blocks.
  const logByDate = new Map(last7.map(l => [new Date(l.date).toISOString().slice(0, 10), l]))
  const barsData: { key: string; day: string; pct: number | null }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const log = logByDate.get(key)
    const pct = log?.targetCalories ? Math.min(100, Math.round((log.totalCaloriesLogged / log.targetCalories) * 100)) : null
    barsData.push({ key, day: d.toLocaleDateString('en-IN', { weekday: 'short' }), pct })
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Last 7 days</h2>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: 'Avg adherence', value: `${avgPct}%`, color: adherenceColor(avgPct) },
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
        {barsData.map(b => {
          const hasLog = b.pct !== null
          const color = hasLog ? adherenceColor(b.pct!) : 'var(--surface-2)'
          const height = hasLog ? Math.max(8, b.pct! * 0.44) : 6
          return (
            <div key={b.key} style={{ flex: 1, maxWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', borderRadius: 4, background: color, height: `${height}px`,
                border: hasLog ? 'none' : '1px dashed var(--border)', transition: 'height 0.3s ease',
              }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{b.day}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayCard({ log, isMockData }: { log: DailyLog; isMockData: boolean }) {
  const pct = log.targetCalories ? Math.round((log.totalCaloriesLogged / log.targetCalories) * 100) : 0
  const color = adherenceColor(pct)
  const date = new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const href = isMockData
    ? `/history/${log.id}?mock=1&date=${encodeURIComponent(log.date)}&cal=${log.totalCaloriesLogged}&meals=${log.mealCount}`
    : `/history/${log.id}`

  return (
    <Link href={href} className="card" style={{
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      textDecoration: 'none', transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 17 }}>{pct >= 85 ? '✅' : pct >= 60 ? '⚡' : '💧'}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{date}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{log.mealCount} meal{log.mealCount !== 1 ? 's' : ''} · {log.totalCaloriesLogged} kcal</div>
      </div>
      <AdherenceBadge pct={pct} />
      <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>›</span>
    </Link>
  )
}

function MonthSection({ group, isMockData, expanded, onToggle }: {
  group: { key: string; label: string; logs: DailyLog[] }
  isMockData: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const avgPct = Math.round(
    group.logs.reduce((s, l) => s + (l.targetCalories ? (l.totalCaloriesLogged / l.targetCalories) * 100 : 0), 0) / group.logs.length
  )
  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{group.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '2px 8px' }}>
            {group.logs.length} day{group.logs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: adherenceColor(avgPct) }}>{avgPct}% avg</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {group.logs.map(log => <DayCard key={log.id} log={log} isMockData={isMockData} />)}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [summary, setSummary] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [isMockData, setIsMockData] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    // ?preview=mock forces the long-history mock view regardless of real data —
    // handy for visualizing/designing against a 3-month-tenure user without seeding the DB
    if (new URLSearchParams(window.location.search).get('preview') === 'mock') {
      const mock = makeMockLogs()
      setLogs(mock)
      setSummary(mock.map(l => ({ date: l.date, totalCaloriesLogged: l.totalCaloriesLogged, targetCalories: l.targetCalories })))
      setIsMockData(true)
      setLoading(false)
      return
    }

    Promise.all([
      fetch('/api/history?offset=0').then(r => r.json()),
      fetch('/api/history?summary=1').then(r => r.json()),
    ]).then(([d, sumD]) => {
      const real = d.logs ?? []
      if (real.length === 0) {
        const mock = makeMockLogs()
        setLogs(mock)
        setSummary(mock.map(l => ({ date: l.date, totalCaloriesLogged: l.totalCaloriesLogged, targetCalories: l.targetCalories })))
        setIsMockData(true)
      } else {
        setLogs(real)
        setSummary(sumD.summary ?? [])
        setHasMore(d.hasMore ?? false)
        setOffset(real.length)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const monthGroups = useMemo(() => groupByMonth(logs), [logs])

  // Default: most recent month open, rest collapsed — keeps initial DOM small for long histories
  useEffect(() => {
    if (monthGroups.length > 0) setExpandedMonths(new Set([monthGroups[0].key]))
  }, [monthGroups.length])

  function toggleMonth(key: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/history?offset=${offset}`)
      const d = await r.json()
      const more = d.logs ?? []
      setLogs(prev => [...prev, ...more])
      setHasMore(d.hasMore ?? false)
      setOffset(prev => prev + more.length)
    } catch { /* ignore */ }
    finally { setLoadingMore(false) }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
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

      {loading && (() => {
        const sk = { background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' } as const
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2" style={{ gap: 12, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ width: 90, height: 16, borderRadius: 5, ...sk, marginBottom: 18 }} />
                <div className="grid-3" style={{ marginBottom: 20 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 70, height: 30, borderRadius: 6, ...sk }} />
                      <div style={{ width: 90, height: 10, borderRadius: 3, ...sk }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48 }}>
                  {[75, 90, 55, 95, 80, 60, 85].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', borderRadius: 4, ...sk, height: `${Math.max(8, h * 0.44)}px` }} />
                      <div style={{ width: '100%', height: 10, borderRadius: 3, ...sk }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ width: 120, height: 16, borderRadius: 5, ...sk, marginBottom: 18 }} />
                <div style={{ width: '100%', height: 110, borderRadius: 8, ...sk }} />
              </div>
            </div>
            {[1, 2].map(i => (
              <div key={i} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ width: 160, height: 16, borderRadius: 4, ...sk }} />
              </div>
            ))}
          </div>
        )
      })()}

      {!loading && (
        <>
          <div className="grid-2" style={{ gap: 12, alignItems: 'stretch', marginBottom: 12 }}>
            <WeeklySummary logs={logs} />
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Adherence overview</h2>
              <AdherenceHeatmap summary={summary} />
            </div>
          </div>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Daily logs</h2>
            {monthGroups.map(group => (
              <MonthSection
                key={group.key}
                group={group}
                isMockData={isMockData}
                expanded={expandedMonths.has(group.key)}
                onToggle={() => toggleMonth(group.key)}
              />
            ))}
          </div>

          {!isMockData && hasMore && (
            <button
              className="btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ width: '100%', marginTop: 12, padding: '12px' }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
