// src/renderer/src/pages/Dashboard.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Package, ScanLine, TrendingUp, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'

export function Dashboard() {
  const navigate = useNavigate()
  const { stats, fetchStats, loading } = useProducts()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const statCards = [
    {
      label: 'Total Devices',
      value: stats?.total ?? 0,
      icon: Package,
      color: '#6366f1',
      glow: 'rgba(99,102,241,0.2)',
    },
    {
      label: 'Available',
      value: stats?.available ?? 0,
      icon: CheckCircle,
      color: '#10b981',
      glow: 'rgba(16,185,129,0.2)',
    },
    {
      label: 'Sold',
      value: stats?.sold ?? 0,
      icon: TrendingUp,
      color: '#22d3ee',
      glow: 'rgba(34,211,238,0.2)',
    },
    {
      label: 'Reserved',
      value: stats?.reserved ?? 0,
      icon: Clock,
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.2)',
    },
    {
      label: 'Damaged',
      value: stats?.damaged ?? 0,
      icon: XCircle,
      color: '#ef4444',
      glow: 'rgba(239,68,68,0.2)',
    },
  ]

  const quickActions = [
    { label: 'Create Label', description: 'Add new iPhone & print label', icon: Tag, to: '/create-label', color: '#6366f1' },
    { label: 'Scan Device', description: 'Scan IMEI to find or update', icon: ScanLine, to: '/scanner', color: '#22d3ee' },
    { label: 'View Labels', description: 'Browse and print all labels', icon: Package, to: '/labels', color: '#10b981' },
  ]

  return (
    <div className="animate-fade-in space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          iPhone inventory and label management overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-4 border transition-all hover:scale-[1.02]"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg mb-3"
              style={{ background: `${card.glow}`, border: `1px solid ${card.color}30` }}
            >
              <card.icon size={18} style={{ color: card.color }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? '—' : card.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-faint)' }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="text-left rounded-xl p-5 border transition-all hover:scale-[1.02] hover:border-opacity-50"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${action.color}40`
                ;(e.currentTarget as HTMLElement).style.background = `${action.color}08`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'
              }}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                style={{ background: `${action.color}18`, border: `1px solid ${action.color}30` }}
              >
                <action.icon size={20} style={{ color: action.color }} />
              </div>
              <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                {action.label}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {action.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="rounded-xl p-4 border flex items-start gap-3"
        style={{
          background: 'rgba(99,102,241,0.06)',
          borderColor: 'rgba(99,102,241,0.2)',
        }}
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#818cf8' }} />
        <div>
          <div className="text-sm font-medium" style={{ color: '#a5b4fc' }}>
            USB Barcode Scanner Ready
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Connect your USB barcode scanner and navigate to the Scanner page to scan IMEI barcodes directly.
            The scanner works as a keyboard input device — no drivers needed.
          </div>
        </div>
      </div>
    </div>
  )
}