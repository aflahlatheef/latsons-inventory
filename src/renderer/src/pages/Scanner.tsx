// src/renderer/src/pages/Scanner.tsx
import { useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Smartphone } from 'lucide-react'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { useProducts } from '../hooks/useProducts'
import { PRODUCT_STATUSES } from '../../../types/shared'
import type { Product, ProductStatus } from '../../../types/shared'

type ScanMode = 'lookup' | 'status-change'

const STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  sold: '#818cf8',
  reserved: '#f59e0b',
  damaged: '#ef4444',
  returned: '#9ca3af',
}

export function Scanner() {
  const [mode, setMode] = useState<ScanMode>('lookup')
  const [targetStatus, setTargetStatus] = useState<ProductStatus>('sold')
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanLog, setScanLog] = useState<{ imei: string; result: string; time: string }[]>([])
  const [manualImei, setManualImei] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const { findByImei, updateStatusByImei } = useProducts()

  const processImei = useCallback(
    async (imei: string) => {
      if (isProcessing || !imei.trim()) return
      setIsProcessing(true)
      setScanError(null)
      setScannedProduct(null)

      const time = new Date().toLocaleTimeString()

      try {
        const product = await findByImei(imei.trim())

        if (!product) {
          setScanError(`IMEI ${imei} not found in database`)
          setScanLog((prev) => [{ imei, result: '❌ Not found', time }, ...prev.slice(0, 49)])
        } else {
          if (mode === 'lookup') {
            setScannedProduct(product)
            setScanLog((prev) => [{ imei, result: `✓ ${product.model} ${product.storage}`, time }, ...prev.slice(0, 49)])
          } else {
            const oldStatus = product.status
            const updated = await updateStatusByImei(imei, targetStatus)
            setScannedProduct(updated)
            setScanLog((prev) => [
              { imei, result: `✓ ${oldStatus} → ${targetStatus}`, time },
              ...prev.slice(0, 49),
            ])
          }
        }
      } catch (err) {
        setScanError(String(err))
        setScanLog((prev) => [{ imei, result: `❌ Error`, time }, ...prev.slice(0, 49)])
      } finally {
        setIsProcessing(false)
      }
    },
    [isProcessing, mode, targetStatus, findByImei, updateStatusByImei]
  )

  const { isListening, startListening, stopListening } = useBarcodeScanner(processImei)

  // Auto-start listening when component mounts
  useEffect(() => {
    startListening()
    return () => stopListening()
  }, [startListening, stopListening])

  const handleManualSearch = () => {
    if (manualImei.trim()) {
      processImei(manualImei.trim())
      setManualImei('')
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Barcode Scanner</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            USB barcode scanner or manual IMEI entry
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
          style={{
            background: isListening ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            borderColor: isListening ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
            color: isListening ? '#10b981' : '#ef4444',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: isListening ? '#10b981' : '#ef4444',
              animation: isListening ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
            }}
          />
          {isListening ? 'Scanner Active' : 'Scanner Inactive'}
        </div>
      </div>

      {/* Mode selector */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-faint)' }}>
          Scan Mode
        </div>
        <div className="flex gap-3 mb-4">
          {(['lookup', 'status-change'] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
              style={{
                background: mode === m ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-2)',
                borderColor: mode === m ? 'rgba(99,102,241,0.4)' : 'var(--color-border)',
                color: mode === m ? '#818cf8' : 'var(--color-text-muted)',
              }}
            >
              {m === 'lookup' ? '🔍 Lookup Device' : '🔄 Change Status'}
            </button>
          ))}
        </div>

        {mode === 'status-change' && (
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Change scanned devices to:
            </div>
            <div className="flex gap-2 flex-wrap">
              {PRODUCT_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setTargetStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-all"
                  style={{
                    background: targetStatus === s ? `${STATUS_COLORS[s]}20` : 'var(--color-surface-2)',
                    borderColor: targetStatus === s ? `${STATUS_COLORS[s]}50` : 'var(--color-border)',
                    color: targetStatus === s ? STATUS_COLORS[s] : 'var(--color-text-muted)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="text-xs mt-2" style={{ color: 'rgba(99,102,241,0.8)' }}>
              Scan a barcode → status will automatically change to <strong>{targetStatus}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Manual input */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-faint)' }}>
          Manual IMEI Entry
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualImei}
            onChange={(e) => setManualImei(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Type IMEI and press Enter..."
            className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono outline-none"
            style={{
              background: 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            onClick={handleManualSearch}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Scan result */}
      {(scannedProduct || scanError) && (
        <div
          className="rounded-xl border p-5 animate-fade-in"
          style={{
            background: scannedProduct ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            borderColor: scannedProduct ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
          }}
        >
          {scanError ? (
            <div className="flex items-center gap-2">
              <XCircle size={18} style={{ color: '#ef4444' }} />
              <span className="text-sm font-medium" style={{ color: '#ef4444' }}>{scanError}</span>
            </div>
          ) : scannedProduct ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} style={{ color: '#10b981' }} />
                <span className="text-sm font-semibold" style={{ color: '#10b981' }}>
                  Device Found
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <DetailRow label="Model" value={`${scannedProduct.model} ${scannedProduct.storage}`} />
                  <DetailRow label="IMEI" value={scannedProduct.imei} mono />
                  <DetailRow label="Serial" value={scannedProduct.serial_number ?? '—'} mono />
                  <DetailRow label="Model Code" value={scannedProduct.model_code} mono />
                </div>
                <div className="space-y-2">
                  <DetailRow label="Color" value={scannedProduct.color} />
                  <DetailRow label="Battery" value={`${scannedProduct.battery_health}%`} />
                  <DetailRow label="Grade" value={scannedProduct.grade} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Status</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize status-${scannedProduct.status}`}
                    >
                      {scannedProduct.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Scan log */}
      {scanLog.length > 0 && (
        <div
          className="rounded-xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="px-5 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
              Scan History
            </span>
            <button
              onClick={() => setScanLog([])}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--color-text-faint)' }}
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {scanLog.map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-2.5 border-b last:border-0 text-xs"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={12} style={{ color: 'var(--color-text-faint)' }} />
                  <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>{log.imei}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ color: 'var(--color-text)' }}>{log.result}</span>
                  <span style={{ color: 'var(--color-text-faint)' }}>{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className={`text-xs font-medium ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--color-text)' }}
      >
        {value}
      </span>
    </div>
  )
}