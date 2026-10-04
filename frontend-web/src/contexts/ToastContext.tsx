import React, { createContext, useContext, useEffect, useState } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  title?: string
  duration?: number
}

interface ToastContextValue {
  showToast: (t: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast(t: Omit<Toast, 'id'>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = { id, ...t, duration: t.duration ?? 4000 }
    setToasts((s) => [...s, toast])
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration)
    }
    return id
  }

  function removeToast(id: string) {
    setToasts((s) => s.filter((t) => t.id !== id))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: any) => {
      const detail = ev && ev.detail ? ev.detail : ev
      const type: ToastType = detail.type || 'error'
      const message = detail.message || String(detail || '')
      showToast({ type, message })
    }
    window.addEventListener('bf-toast', handler as EventListener)
    return () => window.removeEventListener('bf-toast', handler as EventListener)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-message">{t.message}</div>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Close">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
