// src/renderer/src/components/layout/TitleBar.tsx
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
  return (
    <div
      className="titlebar-drag flex items-center justify-between px-4 h-10 shrink-0 border-b"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* App identity */}
      <div className="titlebar-no-drag flex items-center gap-2">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          LATSONS INVENTORY MANAGEMENT
        </span>
      </div>

      {/* Window controls */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={() => window.api.window.minimize()}
          className="flex items-center justify-center w-8 h-7 rounded-md transition-colors hover:bg-white/10"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="flex items-center justify-center w-8 h-7 rounded-md transition-colors hover:bg-white/10"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="flex items-center justify-center w-8 h-7 rounded-md transition-colors hover:bg-red-500/20 hover:text-red-400"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}