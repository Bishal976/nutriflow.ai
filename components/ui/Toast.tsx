'use client'
import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }
interface ToastCtx { toast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current
    setToasts(t => [...t, { id, message, type }])
    const duration = type === 'error' ? 7000 : 4000
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '✓' },
    error: { bg: '#FEF2F2', border: '#FECACA', icon: '✕' },
    info: { bg: 'rgba(45,125,125,0.08)', border: 'rgba(45,125,125,0.25)', icon: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: colors[t.type].bg,
            border: `1px solid ${colors[t.type].border}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            minWidth: 240,
            maxWidth: 360,
            animation: 'slideInRight 0.25s ease',
          }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{colors[t.type].icon}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
