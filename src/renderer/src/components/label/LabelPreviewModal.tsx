// src/renderer/src/components/label/LabelPreviewModal.tsx
import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { X, Printer, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { LabelPreview } from './LabelPreview'
import type { LabelExtras } from './LabelPreview'
import type { LabelWithProduct, Product } from '../../../../types/shared'

interface LabelPreviewModalProps {
  label: LabelWithProduct
  labels?: LabelWithProduct[]
  currentIndex?: number
  onClose: () => void
  onNavigate?: (index: number) => void
  onMarkPrinted?: (id: string) => void
}

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

// Parse label extras back out of the stored qr_data JSON
function extrasFromQrData(qrData: string): import('./LabelPreview').LabelExtras {
  try {
    // If it's a URL (old format), return empty extras
    if (qrData.startsWith('http')) return {}
    const parsed = JSON.parse(qrData)
    return {
      region_badge: (parsed.badge as 'EU+' | 'DU+') ?? 'EU+',
      activation: parsed.activation ?? 'Yes',
      reg: parsed.reg ?? '',
      batch_no: parsed.batch ?? '',
    }
  } catch {
    return {}
  }
}

export function LabelPreviewModal({
  label,
  labels = [],
  currentIndex = 0,
  onClose,
  onNavigate,
  onMarkPrinted,
}: LabelPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const product = toFullProduct(label)
  const extras = extrasFromQrData(label.qr_data)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label-${product.imei}`,
    onAfterPrint: async () => {
      if (onMarkPrinted) onMarkPrinted(label.id)
    },
  })

  const handleDownloadPNG = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas')
      const el = printRef.current
      if (!el) return
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth + 40,
      })
      const link = document.createElement('a')
      link.download = `label-${product.imei}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      handlePrint()
    }
  }

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < labels.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          maxWidth: 600,
          width: '95vw',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {product.model} · {product.storage}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {product.imei}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {labels.length > 1 && (
              <span className="text-xs px-2 py-1 rounded-md border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-faint)' }}>
                {currentIndex + 1} / {labels.length}
              </span>
            )}
            <button onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--color-text-muted)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Label preview */}
        <div className="p-6 flex justify-center overflow-x-auto" style={{ background: '#e8e8e8' }}>
          <div ref={printRef} style={{ display: 'inline-block', background: 'white', padding: '12px', borderRadius: '6px' }}>
            <LabelPreview product={product} extras={extras} showBorder={false} scale={1} />
          </div>
        </div>

        {/* Meta info bar */}
        <div className="px-5 py-3 border-t border-b flex items-center gap-4 text-xs flex-wrap"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-faint)' }}>
          <span>Created: {new Date(label.created_at).toLocaleDateString()}</span>
          {label.printed_at && (
            <span style={{ color: '#10b981' }}>✓ Printed {new Date(label.printed_at).toLocaleDateString()}</span>
          )}
          {extras.batch_no && (
            <span style={{ color: '#818cf8' }}>B.NO: {extras.batch_no}</span>
          )}
          {extras.reg && (
            <span>REG: {extras.reg}</span>
          )}
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs capitalize border"
            style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>
            {product.grade}
          </span>
          <span>🔋 {product.battery_health}%</span>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
          {labels.length > 1 && onNavigate && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => hasPrev && onNavigate(currentIndex - 1)} disabled={!hasPrev}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--color-border)', color: hasPrev ? 'var(--color-text-muted)' : 'var(--color-text-faint)', opacity: hasPrev ? 1 : 0.4 }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => hasNext && onNavigate(currentIndex + 1)} disabled={!hasNext}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--color-border)', color: hasNext ? 'var(--color-text-muted)' : 'var(--color-text-faint)', opacity: hasNext ? 1 : 0.4 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button onClick={() => handlePrint()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: 'white' }}>
            <Printer size={14} />Print
          </button>

          <button onClick={handleDownloadPNG}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            <Download size={14} />Download PNG
          </button>
        </div>
      </div>
    </div>
  )
}