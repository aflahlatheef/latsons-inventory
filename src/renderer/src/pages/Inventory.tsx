// src/renderer/src/pages/Inventory.tsx
import { useState, useEffect } from 'react'
import { Search, Package, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { IPHONE_MODELS, IPHONE_STORAGE, PRODUCT_STATUSES } from '../../../types/shared'
import type { Product, ProductStatus, UpdateProductDto } from '../../../types/shared'

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  sold:      { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  reserved:  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  damaged:   { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  returned:  { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af', border: 'rgba(156,163,175,0.3)' },
}

export function Inventory() {
  const { products, total, loading, fetchProducts, updateProduct, deleteProduct } = useProducts()
  const [search, setSearch] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStorage, setFilterStorage] = useState('')
  const [orderBy, setOrderBy] = useState('created_at')
  const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('DESC')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<UpdateProductDto>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = () => fetchProducts({
    search: search || undefined,
    model: filterModel || undefined,
    status: filterStatus as ProductStatus || undefined,
    storage: filterStorage || undefined,
    orderBy,
    orderDir,
  })

  useEffect(() => { load() }, [search, filterModel, filterStatus, filterStorage, orderBy, orderDir])

  const handleSort = (col: string) => {
    if (orderBy === col) setOrderDir(d => d === 'ASC' ? 'DESC' : 'ASC')
    else { setOrderBy(col); setOrderDir('DESC') }
  }

  const SortIcon = ({ col }: { col: string }) =>
    orderBy === col
      ? orderDir === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : null

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditForm({ status: product.status, notes: product.notes ?? '' })
  }

  const saveEdit = async () => {
    if (!editingId) return
    await updateProduct(editingId, editForm)
    setEditingId(null)
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteProduct(id)
    setConfirmDelete(null)
    load()
  }

  const COLS: { key: string; label: string; sortable: boolean }[] = [
    { key: 'imei', label: 'IMEI', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    { key: 'storage', label: 'GB', sortable: true },
    { key: 'color', label: 'Color', sortable: false },
    { key: 'grade', label: 'Grade', sortable: true },
    { key: 'battery_health', label: 'Battery', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'created_at', label: 'Added', sortable: true },
    { key: 'actions', label: '', sortable: false },
  ]

  return (
    <div className="animate-fade-in space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Inventory</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {total} device{total !== 1 ? 's' : ''} in database
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-3">
        <div className="relative col-span-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-faint)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IMEI, model..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
        <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <option value="">All Models</option>
          {IPHONE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterStorage} onChange={(e) => setFilterStorage(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <option value="">All Storage</option>
          {IPHONE_STORAGE.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <option value="">All Status</option>
          {PRODUCT_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ background: 'var(--color-surface)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-white' : ''}`}
                    style={{ color: 'var(--color-text-faint)' }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12" style={{ color: 'var(--color-text-faint)' }}>
                    <Package size={32} className="mx-auto mb-3 opacity-30" />
                    <div className="text-sm">No devices found</div>
                  </td>
                </tr>
              ) : products.map(product => (
                <tr
                  key={product.id}
                  className="border-t hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {product.imei}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                    {product.model}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {product.storage}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {product.color}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                    {product.grade}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span style={{
                      color: product.battery_health >= 85 ? '#10b981' : product.battery_health >= 70 ? '#f59e0b' : '#ef4444'
                    }}>
                      {product.battery_health}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === product.id ? (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value as ProductStatus }))}
                        className="px-2 py-1 rounded text-xs border outline-none"
                        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        autoFocus
                      >
                        {PRODUCT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full border capitalize"
                        style={{
                          background: STATUS_COLORS[product.status]?.bg ?? '',
                          color: STATUS_COLORS[product.status]?.text ?? '',
                          borderColor: STATUS_COLORS[product.status]?.border ?? '',
                        }}
                      >
                        {product.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-faint)' }}>
                    {new Date(product.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === product.id ? (
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-text-faint)' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => startEdit(product)} className="p-1.5 rounded hover:bg-indigo-500/15 transition-colors" style={{ color: '#818cf8' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setConfirmDelete(product.id)} className="p-1.5 rounded hover:bg-red-500/15 transition-colors" style={{ color: '#ef4444' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border p-6 w-80 space-y-4" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Delete this device?</div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              All associated labels will also be deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}