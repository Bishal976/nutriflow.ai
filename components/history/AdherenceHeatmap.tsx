'use client'

interface DaySummary { date: string; totalCaloriesLogged: number; targetCalories: number | null }

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const CELL = 12
const GAP = 3

function colorForPct(pct: number | null): string {
  if (pct === null) return 'rgba(255,255,255,0.04)'
  if (pct >= 85) return 'rgba(76,175,125,0.85)'
  if (pct >= 60) return 'rgba(245,166,35,0.65)'
  return 'rgba(224,90,90,0.55)'
}

export default function AdherenceHeatmap({ summary }: { summary: DaySummary[] }) {
  if (summary.length === 0) return null

  const pctByDate = new Map<string, number | null>()
  summary.forEach(s => {
    const key = new Date(s.date).toISOString().slice(0, 10)
    const pct = s.targetCalories ? Math.round((s.totalCaloriesLogged / s.targetCalories) * 100) : null
    pctByDate.set(key, pct)
  })

  const times = summary.map(s => new Date(s.date).getTime())
  const oldest = new Date(Math.min(...times))
  const newest = new Date(Math.max(...times))

  // Align the grid to full weeks (Sunday → Saturday columns), GitHub-style
  const start = new Date(oldest)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(newest)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const weeks: Date[][] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  // When two month boundaries land closer together than the label text needs (e.g.
  // "May"/"Jun" one week apart on a short range), drop the older one in favor of the
  // newer — otherwise they overlap into "MayJun", and the current month is what matters most
  const MIN_LABEL_GAP = 28
  const monthLabels: { weekIdx: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, i) => {
    const m = week[0].getMonth()
    if (m !== lastMonth) {
      const x = i * (CELL + GAP)
      const prev = monthLabels[monthLabels.length - 1]
      if (prev && x - prev.weekIdx * (CELL + GAP) < MIN_LABEL_GAP) monthLabels.pop()
      monthLabels.push({ weekIdx: i, label: week[0].toLocaleDateString('en-IN', { month: 'short' }) })
      lastMonth = m
    }
  })

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, minWidth: weeks.length * (CELL + GAP) + 28 }}>
        <div style={{ position: 'relative', height: 14, marginLeft: 28 }}>
          {monthLabels.map(({ weekIdx, label }) => (
            <span key={weekIdx} style={{ position: 'absolute', left: weekIdx * (CELL + GAP), fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: GAP }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: 24, flexShrink: 0 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ height: CELL, fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{label}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {week.map((day, di) => {
                const key = day.toISOString().slice(0, 10)
                const inRange = day >= oldest && day <= newest
                const pct = pctByDate.has(key) ? pctByDate.get(key)! : null
                const title = inRange
                  ? `${day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}${pct !== null ? ` · ${pct}% of target` : ' · no log'}`
                  : undefined
                return (
                  <div
                    key={di}
                    title={title}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      background: inRange ? colorForPct(pct) : 'transparent',
                      border: inRange && pct === null ? '1px solid var(--border)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 28, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Less</span>
          {([null, 30, 70, 90] as const).map((p, i) => (
            <div key={i} style={{ width: CELL, height: CELL, borderRadius: 3, background: colorForPct(p), border: p === null ? '1px solid var(--border)' : 'none' }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>More</span>
        </div>
      </div>
    </div>
  )
}
