// src/renderer/src/components/iphone/IphoneUSBConnect.tsx
// Shows USB connection status and a "Read from iPhone" button.
// Integrates with libimobiledevice via the iphone IPC handler.

import { useEffect, useRef } from 'react'
import { Smartphone, Plug, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useIphoneUSB } from '../../hooks/useIphoneUSB'
import type { IphoneUSBData } from '../../hooks/useIphoneUSB'

interface IphoneUSBConnectProps {
  onDataRead: (data: IphoneUSBData) => void
}

export function IphoneUSBConnect({ onDataRead }: IphoneUSBConnectProps) {
  const { status, deviceData, isReading, error, readDevice, refresh } = useIphoneUSB(true)

  // ─── THE CORE FIX ───────────────────────────────────────────────────────────
  // useIphoneUSB(true) auto-reads the device internally when it detects a
  // connection. That sets `deviceData` state inside the hook, but the old code
  // only called `onDataRead` from the manual button click handler.
  // This effect watches `deviceData` and fires `onDataRead` any time a new
  // device's data arrives — whether from auto-read or a manual re-read.
  const lastFilledKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!deviceData || status !== 'trusted') return
    // Use UDID or IMEI or serial as a unique identity key so we don't
    // re-fire for the same device on every re-render.
    const key = deviceData.udid ?? deviceData.imei ?? deviceData.serial_number
    if (!key || key === lastFilledKeyRef.current) return

    lastFilledKeyRef.current = key
    onDataRead(deviceData)
  }, [deviceData, status, onDataRead])
  // ────────────────────────────────────────────────────────────────────────────

  const handleRead = async () => {
    const data = await readDevice()
    if (data) {
      // Reset the key so the effect doesn't double-fire if the user re-reads
      // the same device (same UDID) after manually clicking — the button click
      // already calls onDataRead here directly.
      lastFilledKeyRef.current = null
      onDataRead(data)
    }
  }

  // Don't show anything if libimobiledevice isn't installed
  if (status === 'unavailable') {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}
      >
        <div className="flex items-start gap-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
              iPhone USB Auto-fill Not Available
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Install{' '}
              <code
                className="font-mono px-1 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                libimobiledevice
              </code>{' '}
              to enable plug-in auto-fill:
            </div>
            <div className="mt-2 space-y-1">
              <div
                className="text-xs font-mono px-2 py-1 rounded"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--color-text-faint)',
                }}
              >
                macOS: brew install libimobiledevice
              </div>
              <div
                className="text-xs font-mono px-2 py-1 rounded"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--color-text-faint)',
                }}
              >
                Linux: sudo apt install libimobiledevice-utils
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        background:
          status === 'trusted'
            ? 'rgba(16,185,129,0.06)'
            : status === 'connected'
              ? 'rgba(99,102,241,0.06)'
              : 'rgba(255,255,255,0.02)',
        borderColor:
          status === 'trusted'
            ? 'rgba(16,185,129,0.25)'
            : status === 'connected'
              ? 'rgba(99,102,241,0.25)'
              : 'var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{
              background:
                status === 'trusted'
                  ? 'rgba(16,185,129,0.15)'
                  : status === 'connected'
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(255,255,255,0.05)',
            }}
          >
            <Smartphone
              size={18}
              style={{
                color:
                  status === 'trusted'
                    ? '#10b981'
                    : status === 'connected'
                      ? '#818cf8'
                      : 'var(--color-text-faint)',
              }}
            />
          </div>

          <div className="min-w-0">
            <div
              className="text-sm font-semibold flex items-center gap-2"
              style={{ color: 'var(--color-text)' }}
            >
              {status === 'checking' && 'Checking USB...'}
              {status === 'disconnected' && 'No iPhone Connected'}
              {status === 'connected' && 'iPhone Connected!'}
              {status === 'trusted' && (deviceData?.device_name ?? 'iPhone Detected')}
              {status === 'error' && 'Connection Error'}

              {/* Live dot */}
              {status === 'trusted' && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: '#10b981' }}
                />
              )}
              {status === 'connected' && (
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ background: '#818cf8' }}
                />
              )}
            </div>

            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {status === 'checking' && 'Looking for connected devices...'}
              {status === 'disconnected' && 'Plug in your iPhone via USB cable'}
              {status === 'connected' && 'Tap "Trust This Computer" on your iPhone'}
              {status === 'trusted' && deviceData && (
                <span>
                  {deviceData.model_name ?? ''}
                  {deviceData.storage_gb ? ` · ${deviceData.storage_gb} GB` : ''}
                  {deviceData.ios_version ? ` · ${deviceData.ios_version}` : ''}
                </span>
              )}
              {status === 'error' && (error ?? 'Something went wrong')}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh */}
          <button
            onClick={refresh}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-text-faint)' }}
            title="Refresh connection"
          >
            <RefreshCw size={13} className={status === 'checking' ? 'animate-spin' : ''} />
          </button>

          {/* Main CTA — device connected but not yet trusted/read */}
          {status === 'connected' && (
            <button
              onClick={handleRead}
              disabled={isReading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              {isReading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Reading...
                </>
              ) : (
                <>
                  <Plug size={13} />
                  Read Device
                </>
              )}
            </button>
          )}

          {/* Re-read button once trusted */}
          {status === 'trusted' && (
            <button
              onClick={handleRead}
              disabled={isReading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
            >
              {isReading ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Re-reading...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Re-read
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Device detail chips (when trusted) */}
      {status === 'trusted' && deviceData && (
        <div
          className="flex flex-wrap gap-2 mt-3 pt-3 border-t"
          style={{ borderColor: 'rgba(16,185,129,0.15)' }}
        >
          {deviceData.imei && <Chip label="IMEI" value={deviceData.imei} color="#818cf8" />}
          {deviceData.serial_number && (
            <Chip label="Serial" value={deviceData.serial_number} color="#22d3ee" />
          )}
          {deviceData.model_number && (
            <Chip label="Model #" value={deviceData.model_number} color="#f59e0b" />
          )}
          {deviceData.color && (
            <Chip label="Color" value={deviceData.color} color="#10b981" />
          )}
          {deviceData.battery_health !== null && deviceData.battery_health !== undefined && (
            <Chip
              label="Battery"
              value={`${deviceData.battery_health}%`}
              color={
                deviceData.battery_health >= 85
                  ? '#10b981'
                  : deviceData.battery_health >= 70
                    ? '#f59e0b'
                    : '#ef4444'
              }
            />
          )}
          {deviceData.storage_gb && (
            <Chip label="Storage" value={`${deviceData.storage_gb} GB`} color="#a78bfa" />
          )}
          {deviceData.ios_version && (
            <Chip label="iOS" value={deviceData.ios_version} color="#22d3ee" />
          )}
          <div
            className="flex items-center gap-1 ml-auto text-xs font-medium px-2 py-1 rounded-lg"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
          >
            <CheckCircle size={11} />
            Auto-filled
          </div>
        </div>
      )}

      {/* Error detail */}
      {status === 'error' && error && (
        <div
          className="mt-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono"
      style={{ borderColor: `${color}30`, background: `${color}10`, color }}
    >
      <span className="font-sans font-medium opacity-70">{label}:</span>
      <span>{value}</span>
    </div>
  )
}