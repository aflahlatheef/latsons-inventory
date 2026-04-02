// src/renderer/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Tag,
  List,
  ScanLine,
  Package,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/create-label', icon: Tag, label: 'Create Label' },
  { to: '/labels', icon: List, label: 'All Labels' },
  { to: '/scanner', icon: ScanLine, label: 'Scanner' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
]

export function Sidebar() {
  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/15 text-primary-400 border border-primary/20'
                  : 'text-muted hover:bg-white/5 hover:text-white border border-transparent'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(99,102,241,0.12)' : undefined,
              color: isActive ? '#818cf8' : 'var(--color-text-muted)',
              borderColor: isActive ? 'rgba(99,102,241,0.25)' : 'transparent',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="p-4 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
          v1.0.0 • LATSONS
        </div>
      </div>
    </aside>
  )
}