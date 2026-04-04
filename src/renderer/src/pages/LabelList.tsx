// src/renderer/src/pages/LabelList.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Search, Printer, Trash2, Calendar, Filter,
  Download, Eye, CheckSquare, Square, ChevronDown,
  Package, X, FileDown, Pencil, CheckCircle, AlertCircle,
} from 'lucide-react'
import { useLabels } from '../hooks/useLabels'
import { LabelPreview } from '../components/label/LabelPreview'
import { IPHONE_MODELS, IPHONE_STORAGE, IPHONE_COLORS } from '../../../types/shared'
import type { LabelWithProduct, Product } from '../../../types/shared'
import { LabelPreviewModal } from '@renderer/components/label/LabelPreviewModal'

function toFullProduct(label: LabelWithProduct): Product {
  return {
    id: label.product_id,
    imei: label.product.imei as string,
    model: label.product.model as string,
    storage: label.product.storage as string,
    model_code: label.product.model_code as string,
    color: label.product.color as string,
    battery_health: label.product.battery_health as number,
    grade: label.product.grade as string,
    face_id: label.product.face_id as string,
    sim_status: label.product.sim_status as string,
    test_status: label.product.test_status as string,
    ios_version: label.product.ios_version as string,
    serial_number: label.product.serial_number as string | null,
    status: label.product.status,
    notes: null,
    created_at: label.created_at,
    updated_at: label.created_at,
  }
}

async function labelToBlob(label: LabelWithProduct): Promise<Blob | null> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;background:white;padding:10px;z-index:-1;'
    document.body.appendChild(container)

    const p = toFullProduct(label)
    container.innerHTML = `
      <div id="lbl-render" style="
        width:420px;font-family:'Space Grotesk',Arial,sans-serif;
        background:#fff;border:1px solid #d0d0d0;border-radius:6px;
        padding:12px 14px;box-sizing:border-box;
      ">
        <div style="font-size:13px;font-weight:700;color:#000;margin-bottom:8px;letter-spacing:-0.2px;">
          ${p.model}, ${p.storage}, ${p.model_code}
        </div>
        <div style="display:flex;gap:6px;font-size:11px;align-items:stretch;">
          <div style="flex:1;border:1px solid #999;border-radius:4px;padding:6px 8px;">
            ${p.serial_number ? `<div style="color:#000;font-weight:500;margin-bottom:3px;">Sno: ${p.serial_number}</div>` : ''}
            <div style="color:#000;font-weight:500;margin-bottom:3px;">Face id: ${p.face_id}</div>
            <div style="color:#000;font-weight:500;margin-bottom:3px;">Sim: ${p.sim_status}</div>
            <div style="color:#000;font-weight:500;">Tested: ${p.test_status}</div>
          </div>
          <div style="border:1px solid #999;border-radius:4px;padding:6px 8px;white-space:nowrap;">
            <div style="color:#000;margin-bottom:3px;">🔋 <strong>${p.battery_health}%</strong></div>
            <div style="color:#000;margin-bottom:3px;">✦ <strong>${p.grade}</strong></div>
            <div style="color:#000;margin-bottom:3px;">🎨 <strong>${p.color}</strong></div>
            <div style="color:#000;">📱 <strong>${p.ios_version}</strong></div>
          </div>
        </div>
        <div style="font-size:10px;color:#333;font-family:monospace;margin-top:6px;">IMEI: ${p.imei}</div>
        <div style="font-size:9px;color:#666;margin-top:2px;">
          ${new Date(label.created_at).toLocaleDateString()} · LATSONS
        </div>
      </div>
    `

    const el = container.querySelector('#lbl-render') as HTMLElement
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 3,
      useCORS: true,
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: el.offsetWidth + 40,
    })
    document.body.removeChild(container)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}

async function downloadSingleLabel(label: LabelWithProduct) {
  const blob = await labelToBlob(label)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `label-${label.product.imei as string}.png`
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadMultipleLabels(labels: LabelWithProduct[], filename = 'labels') {
  if (labels.length === 0) return
  if (labels.length === 1) return downloadSingleLabel(labels[0])

  try {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const label of labels) {
      const blob = await labelToBlob(label)
      if (blob) zip.file(`label-${label.product.imei as string}.png`, blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    for (const label of labels) {
      await downloadSingleLabel(label)
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}

interface EditLabelForm {
  battery_health: number
  grade: string
  face_id: string
  sim_status: string
  test_status: string
  ios_version: string
  color: string
  storage: string
  model_code: string
}

export function LabelList() {
  const { labels, loading, fetchLabels, deleteLabel, markPrinted } = useLabels()

  const [search, setSearch] = useState('')
  const [model, setModel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [orderBy, setOrderBy] = useState('l.created_at')
  const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('DESC')

  const [previewLabel, setPreviewLabel] = useState<LabelWithProduct | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [editingLabel, setEditingLabel] = useState<LabelWithProduct | null>(null)
  const [editForm, setEditForm] = useState<EditLabelForm | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // ── Print state ──────────────────────────────────────────────────────────
  // Always-mounted print divs — never conditionally rendered
  const printRef = useRef<HTMLDivElement>(null)
  const printAllRef = useRef<HTMLDivElement>(null)

  // What's currently in the print targets
  const [printLabel, setPrintLabel] = useState<LabelWithProduct | null>(null)
  const [printQueue, setPrintQueue] = useState<LabelWithProduct[]>([])

  // Pending print action — set after state update, consumed by useEffect
  const pendingSinglePrint = useRef(false)
  const pendingMultiPrint = useRef(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const currentFilters = {
    search: search || undefined,
    model: model || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    orderBy,
    orderDir,
  }

  useEffect(() => {
    fetchLabels(currentFilters)
  }, [search, model, dateFrom, dateTo, orderBy, orderDir])

  // ── useReactToPrint hooks (always called, never conditional) ────────────
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label-${printLabel?.product.imei ?? 'label'}`,
    onAfterPrint: async () => {
      if (printLabel) {
        await markPrinted(printLabel.id)
        fetchLabels(currentFilters)
      }
    },
  })

  const handlePrintAll = useReactToPrint({
    contentRef: printAllRef,
    documentTitle: `Labels-${new Date().toLocaleDateString()}`,
    onAfterPrint: async () => {
      for (const label of printQueue) {
        await markPrinted(label.id)
      }
      setPrintQueue([])
      fetchLabels(currentFilters)
    },
  })

  // ── Effect: fire print once DOM has updated with new label data ──────────
  useEffect(() => {
    if (pendingSinglePrint.current && printLabel) {
      pendingSinglePrint.current = false
      // Small delay to let React flush the DOM update into printRef
      const t = setTimeout(() => handlePrint(), 100)
      return () => clearTimeout(t)
    }
  }, [printLabel])

  useEffect(() => {
    if (pendingMultiPrint.current && printQueue.length > 0) {
      pendingMultiPrint.current = false
      const t = setTimeout(() => handlePrintAll(), 100)
      return () => clearTimeout(t)
    }
  }, [printQueue])

  // ── Public trigger helpers ───────────────────────────────────────────────
  const triggerPrint = useCallback((label: LabelWithProduct) => {
    pendingSinglePrint.current = true
    setPrintLabel(label)
  }, [])

  const triggerPrintMultiple = useCallback((targetLabels: LabelWithProduct[]) => {
    if (targetLabels.length === 0) return
    if (targetLabels.length === 1) {
      triggerPrint(targetLabels[0])
      return
    }
    pendingMultiPrint.current = true
    setPrintQueue(targetLabels)
  }, [triggerPrint])

  // Selection
  const allSelected = labels.length > 0 && selectedIds.size === labels.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(labels.map((l) => l.id)))
  }

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (id: string) => {
    await deleteLabel(id)
    setConfirmDelete(null)
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    fetchLabels(currentFilters)
    showToast('success', 'Label deleted')
  }

  const handleDeleteSelected = async () => {
    const count = selectedIds.size
    for (const id of selectedIds) await deleteLabel(id)
    setSelectedIds(new Set())
    showToast('success', `Deleted ${count} label(s)`)
    fetchLabels(currentFilters)
  }

  const startEdit = (label: LabelWithProduct) => {
    setEditingLabel(label)
    setEditForm({
      battery_health: label.product.battery_health as number,
      grade: label.product.grade as string,
      face_id: label.product.face_id as string,
      sim_status: label.product.sim_status as string,
      test_status: label.product.test_status as string,
      ios_version: label.product.ios_version as string,
      color: label.product.color as string,
      storage: label.product.storage as string,
      model_code: label.product.model_code as string,
    })
  }

  const saveEdit = async () => {
    if (!editingLabel || !editForm) return
    setIsSavingEdit(true)
    try {
      // @ts-expect-error
      await window.api.product.update(editingLabel.product_id, {
        battery_health: editForm.battery_health,
        grade: editForm.grade,
        face_id: editForm.face_id,
        sim_status: editForm.sim_status,
        test_status: editForm.test_status,
        ios_version: editForm.ios_version,
        color: editForm.color,
        storage: editForm.storage,
        model_code: editForm.model_code,
      })
      setEditingLabel(null)
      setEditForm(null)
      fetchLabels(currentFilters)
      showToast('success', 'Label updated successfully!')
    } catch (err) {
      showToast('error', String(err))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDownloadSelected = async () => {
    const targets = labels.filter((l) => selectedIds.has(l.id))
    if (!targets.length) return
    setIsDownloading(true)
    try {
      await downloadMultipleLabels(targets, 'selected-labels')
      showToast('success', `Downloaded ${targets.length} label(s)`)
    } catch { showToast('error', 'Download failed') }
    finally { setIsDownloading(false) }
  }

  const handleDownloadAll = async () => {
    if (!labels.length) return
    setIsDownloading(true); setDownloadMenuOpen(false)
    try {
      await downloadMultipleLabels(labels, `labels-all`)
      showToast('success', `Downloaded ${labels.length} label(s)`)
    } catch { showToast('error', 'Download failed') }
    finally { setIsDownloading(false) }
  }

  const handleDownloadFiltered = async () => {
    if (!labels.length) return
    setIsDownloading(true); setDownloadMenuOpen(false)
    try {
      const name = [model || 'all-models', dateFrom ? `from-${dateFrom}` : '', dateTo ? `to-${dateTo}` : ''].filter(Boolean).join('_')
      await downloadMultipleLabels(labels, `labels-${name}`)
      showToast('success', `Downloaded ${labels.length} filtered label(s)`)
    } catch { showToast('error', 'Download failed') }
    finally { setIsDownloading(false) }
  }

  const handlePrintAll2 = () => {
    setDownloadMenuOpen(false)
    triggerPrintMultiple(labels)
  }

  const handlePrintFiltered = () => {
    setDownloadMenuOpen(false)
    triggerPrintMultiple(labels)
  }

  const handlePrintSelected2 = () => {
    setDownloadMenuOpen(false)
    const targets = labels.filter((l) => selectedIds.has(l.id))
    if (!targets.length) { showToast('error', 'Select labels first using the checkboxes'); return }
    triggerPrintMultiple(targets)
  }

  const openPreview = (label: LabelWithProduct) => {
    const idx = labels.findIndex((l) => l.id === label.id)
    setPreviewIndex(idx >= 0 ? idx : 0)
    setPreviewLabel(label)
  }

  const handleNavigate = (idx: number) => {
    if (idx >= 0 && idx < labels.length) {
      setPreviewIndex(idx)
      setPreviewLabel(labels[idx])
    }
  }

  const inputStyle = {
    background: 'var(--color-surface-2)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-14 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg"
          style={{
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            borderColor: toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
            color: toast.type === 'success' ? '#10b981' : '#ef4444',
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>All Labels</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {labels.length} label{labels.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
              style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)', color: '#818cf8' }}
            >
              {selectedIds.size} selected
              <button onClick={handleDownloadSelected} disabled={isDownloading}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-indigo-500/20">
                <Download size={12} />{isDownloading ? '...' : 'Download'}
              </button>
              <button onClick={() => triggerPrintMultiple(labels.filter(l => selectedIds.has(l.id)))}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-indigo-500/20">
                <Printer size={12} />Print
              </button>
              <button onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-red-500/20"
                style={{ color: '#ef4444' }}>
                <Trash2 size={12} />Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="p-0.5 rounded hover:bg-white/10">
                <X size={11} />
              </button>
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setDownloadMenuOpen((v) => !v)}
              disabled={labels.length === 0 || isDownloading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:bg-white/5 disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <FileDown size={14} />
              {isDownloading ? 'Working...' : 'Actions'}
              <ChevronDown size={12} />
            </button>

            {downloadMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl border shadow-xl z-40 overflow-hidden"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', minWidth: 220 }}
              >
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b"
                  style={{ color: 'var(--color-text-faint)', borderColor: 'var(--color-border)' }}>
                  Download PNG
                </div>
                <button onClick={handleDownloadAll}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors border-b"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Download size={13} /><span className="font-medium">Download All</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>All {labels.length} labels as ZIP</div>
                </button>
                <button onClick={handleDownloadFiltered}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors border-b"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Download size={13} /><span className="font-medium">Download Filtered</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>Current {labels.length} results{model ? ` · ${model}` : ''}</div>
                </button>
                <button onClick={() => { setDownloadMenuOpen(false); if (selectedIds.size > 0) handleDownloadSelected(); else showToast('error', 'Select labels first') }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors border-b"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Download size={13} /><span className="font-medium">Download Selected</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Check boxes to select'}</div>
                </button>

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b"
                  style={{ color: 'var(--color-text-faint)', borderColor: 'var(--color-border)' }}>
                  Print
                </div>
                <button onClick={handlePrintAll2}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors border-b"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Printer size={13} /><span className="font-medium">Print All</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>Print all {labels.length} labels</div>
                </button>
                <button onClick={handlePrintFiltered}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors border-b"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Printer size={13} /><span className="font-medium">Print Filtered</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>Current {labels.length} filtered results</div>
                </button>
                <button onClick={handlePrintSelected2}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2"><Printer size={13} /><span className="font-medium">Print Selected</span></div>
                  <div className="text-xs mt-0.5 ml-5" style={{ color: 'var(--color-text-faint)' }}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Check boxes to select'}</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Filter size={13} style={{ color: 'var(--color-text-faint)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
            Filters & Sorting
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-faint)' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IMEI, model, serial..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
              style={inputStyle} />
          </div>
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
            <option value="">All Models</option>
            {IPHONE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={13} style={{ color: 'var(--color-text-faint)' }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg border text-xs outline-none" style={inputStyle} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg border text-xs outline-none" style={inputStyle} />
          </div>
          <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}
            className="px-3 py-2 rounded-lg border text-xs outline-none" style={inputStyle}>
            <option value="l.created_at">Sort by Date</option>
            <option value="p.model">Sort by Model</option>
            <option value="p.storage">Sort by Storage</option>
            <option value="p.color">Sort by Color</option>
          </select>
          <button onClick={() => setOrderDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))}
            className="px-3 py-2 rounded-lg border text-xs font-medium transition-colors hover:bg-white/5"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            {orderDir === 'DESC' ? '↓ Newest first' : '↑ Oldest first'}
          </button>
        </div>
      </div>

      {/* Label Grid */}
      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading labels...</div>
      ) : labels.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-faint)' }}>
          <Package size={32} className="mx-auto mb-3 opacity-30" />
          No labels found. Create one from the Create Label page.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1">
            <button onClick={toggleAll}
              className="flex items-center gap-2 text-xs font-medium transition-colors px-2 py-1 rounded-lg border"
              style={{ color: allSelected ? '#818cf8' : 'var(--color-text-muted)', borderColor: allSelected ? 'rgba(99,102,241,0.4)' : 'var(--color-border)', background: allSelected ? 'rgba(99,102,241,0.1)' : 'var(--color-surface)' }}>
              {allSelected ? <CheckSquare size={14} style={{ color: '#818cf8' }} /> : someSelected ? <CheckSquare size={14} style={{ color: '#6366f1', opacity: 0.6 }} /> : <Square size={14} />}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                {selectedIds.size} of {labels.length} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {labels.map((label) => {
              const isSelected = selectedIds.has(label.id)
              return (
                <div key={label.id}
                  className="rounded-xl border transition-all group relative"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: isSelected ? 'rgba(99,102,241,0.6)' : 'var(--color-border)',
                    boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
                  }}>

                  <button
                    onClick={(e) => toggleOne(label.id, e)}
                    className="absolute top-3 left-3 z-20"
                    style={{ lineHeight: 0 }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all"
                      style={{
                        background: isSelected ? '#6366f1' : 'rgba(255,255,255,0.9)',
                        borderColor: isSelected ? '#6366f1' : '#94a3b8',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>

                  <div className="p-4 pt-4 cursor-pointer" onClick={() => openPreview(label)}>
                    <div className="relative overflow-hidden rounded-lg bg-white mb-3 p-2 pl-10 group/preview">
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover/preview:opacity-100 transition-opacity z-10"
                        style={{ background: 'rgba(0,0,0,0.35)' }}>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(255,255,255,0.95)', color: '#111' }}>
                          <Eye size={13} />Preview
                        </div>
                      </div>
                      <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: '128%' }}>
                        <LabelPreview product={toFullProduct(label)} showBorder={false} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                          {label.product.model as string} {label.product.storage as string}
                        </div>
                        <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-faint)' }}>
                          {label.product.imei as string}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                            {new Date(label.created_at).toLocaleDateString()}
                          </span>
                          {label.printed_at && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                              Printed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => startEdit(label)}
                          className="p-2 rounded-lg transition-colors hover:bg-amber-500/15"
                          title="Edit label" style={{ color: '#f59e0b' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openPreview(label)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="Preview label" style={{ color: 'var(--color-text-muted)' }}>
                          <Eye size={14} />
                        </button>
                        <button onClick={() => triggerPrint(label)}
                          className="p-2 rounded-lg transition-colors hover:bg-indigo-500/15"
                          title="Print label" style={{ color: '#818cf8' }}>
                          <Printer size={14} />
                        </button>
                        <button onClick={async () => {
                          setIsDownloading(true)
                          await downloadSingleLabel(label)
                          setIsDownloading(false)
                          showToast('success', 'Label downloaded')
                        }}
                          className="p-2 rounded-lg transition-colors hover:bg-emerald-500/15"
                          title="Download PNG" style={{ color: '#10b981' }}>
                          <Download size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(label.id)}
                          className="p-2 rounded-lg transition-colors hover:bg-red-500/15"
                          title="Delete label" style={{ color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── ALWAYS-MOUNTED print targets ──────────────────────────────────────
          Never conditionally rendered. React keeps them in the DOM at all
          times so printRef / printAllRef are always valid when useReactToPrint
          fires. They are hidden offscreen via CSS. */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        {/* Single label print target */}
        <div ref={printRef} style={{ background: 'white' }}>
          {printLabel && (
            <div className="label-print-wrapper">
              <LabelPreview product={toFullProduct(printLabel)} showBorder={false} />
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        {/* Multi label print target */}
        <div ref={printAllRef} style={{ background: 'white' }}>
          {printQueue.map((label, i) => (
            <div
              key={label.id}
              className="label-print-wrapper"
              style={{ pageBreakAfter: i < printQueue.length - 1 ? 'always' : 'auto' }}
            >
              <LabelPreview product={toFullProduct(label)} showBorder={false} />
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal */}
      {previewLabel && (
        <LabelPreviewModal
          label={previewLabel}
          labels={labels}
          currentIndex={previewIndex}
          onClose={() => setPreviewLabel(null)}
          onNavigate={handleNavigate}
          onMarkPrinted={async (id) => { await markPrinted(id); fetchLabels(currentFilters) }}
        />
      )}

      {/* Edit Label Modal */}
      {editingLabel && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border shadow-2xl w-full max-w-lg mx-4"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Edit Label</div>
                <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  {editingLabel.product.model as string} · {editingLabel.product.imei as string}
                </div>
              </div>
              <button onClick={() => { setEditingLabel(null); setEditForm(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                style={{ color: 'var(--color-text-muted)' }}>
                <X size={15} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Model Code</label>
                  <input type="text" value={editForm.model_code}
                    onChange={(e) => setEditForm(f => f ? { ...f, model_code: e.target.value.toUpperCase() } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none"
                    style={inputStyle} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Storage</label>
                  <select value={editForm.storage} onChange={(e) => setEditForm(f => f ? { ...f, storage: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    {IPHONE_STORAGE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Color</label>
                  <select value={editForm.color} onChange={(e) => setEditForm(f => f ? { ...f, color: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    {IPHONE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Battery: <strong style={{ color: editForm.battery_health >= 85 ? '#10b981' : editForm.battery_health >= 70 ? '#f59e0b' : '#ef4444' }}>{editForm.battery_health}%</strong>
                  </label>
                  <input type="range" min={0} max={100} value={editForm.battery_health}
                    onChange={(e) => setEditForm(f => f ? { ...f, battery_health: Number(e.target.value) } : f)}
                    className="w-full mt-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Grade</label>
                  <select value={editForm.grade} onChange={(e) => setEditForm(f => f ? { ...f, grade: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    {['A+++', 'A++', 'A+', 'A', 'B', 'C'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>iOS Version</label>
                  <input type="text" value={editForm.ios_version}
                    onChange={(e) => setEditForm(f => f ? { ...f, ios_version: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Face ID</label>
                  <select value={editForm.face_id} onChange={(e) => setEditForm(f => f ? { ...f, face_id: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    <option>Working</option><option>Not Working</option><option>N/A</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>SIM</label>
                  <select value={editForm.sim_status} onChange={(e) => setEditForm(f => f ? { ...f, sim_status: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    <option>Unlocked</option><option>Locked</option><option>Unknown</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Tested</label>
                  <select value={editForm.test_status} onChange={(e) => setEditForm(f => f ? { ...f, test_status: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}>
                    <option>Fully</option><option>Partially</option><option>Not Tested</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={saveEdit} disabled={isSavingEdit}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'white' }}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { setEditingLabel(null); setEditForm(null) }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border p-6 w-80 space-y-4"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Delete this label?</div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              This action cannot be undone. The product record will be kept.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadMenuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setDownloadMenuOpen(false)} />
      )}
    </div>
  )
}