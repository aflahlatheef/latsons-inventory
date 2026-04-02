// src/renderer/src/hooks/useIphoneUSB.ts
import { useState, useEffect, useCallback, useRef } from 'react'

export interface IphoneUSBData {
  imei: string | null
  imei2: string | null
  serial_number: string | null
  model_name: string | null
  model_identifier: string | null
  model_number: string | null
  storage_gb: number | null
  color: string | null
  ios_version: string | null
  battery_health: number | null
  device_name: string | null
  udid: string | null
  activation_state: string | null   // "Activated" | "Unactivated"
  region_info: string | null        // "CH/A" | "LL/A" etc.
}

export type USBStatus =
  | 'checking'
  | 'unavailable'
  | 'disconnected'
  | 'connected'
  | 'trusted'
  | 'error'

interface UseIphoneUSBReturn {
  status: USBStatus
  deviceData: IphoneUSBData | null
  deviceCount: number
  isReading: boolean
  error: string | null
  readDevice: (udid?: string) => Promise<IphoneUSBData | null>
  refresh: () => void
}

declare global {
  interface Window {
    api: {
      iphone?: {
        checkStatus: () => Promise<{
          success: boolean
          data?: { available: boolean; connected: boolean; udids: string[] }
          error?: string
        }>
        readDevice: (udid?: string) => Promise<{
          success: boolean
          data?: IphoneUSBData
          error?: string
        }>
        listDevices: () => Promise<{
          success: boolean
          data?: IphoneUSBData[]
          error?: string
        }>
      }
      label: unknown
      window: unknown
    }
  }
}

export function useIphoneUSB(autoRead = true): UseIphoneUSBReturn {
  const [status, setStatus] = useState<USBStatus>('checking')
  const [deviceData, setDeviceData] = useState<IphoneUSBData | null>(null)
  const [deviceCount, setDeviceCount] = useState(0)
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReadingRef = useRef(false)
  const hasDataRef = useRef(false)
  const connectedUdidsRef = useRef<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const readDevice = useCallback(async (udid?: string): Promise<IphoneUSBData | null> => {
    if (!window.api?.iphone) { setError('iPhone USB feature not available'); return null }
    if (isReadingRef.current) return null

    isReadingRef.current = true
    setIsReading(true)
    setError(null)

    try {
      const res = await window.api.iphone.readDevice(udid)
      if (!res.success || !res.data) {
        setStatus('connected')
        setError(res.error ?? 'Could not read device data')
        return null
      }
      setDeviceData(res.data)
      hasDataRef.current = true
      setStatus('trusted')
      return res.data
    } catch (err) {
      setError(String(err))
      setStatus('connected')
      return null
    } finally {
      isReadingRef.current = false
      setIsReading(false)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    if (!window.api?.iphone) { setStatus('unavailable'); return }
    try {
      const res = await window.api.iphone.checkStatus()
      if (!res.success || !res.data) {
        setStatus('error')
        setError(res.error ?? 'Failed to check status')
        return
      }
      const { available, connected, udids } = res.data
      if (!available) { setStatus('unavailable'); return }

      setDeviceCount(udids.length)
      if (!connected) {
        setStatus('disconnected')
        setDeviceData(null)
        hasDataRef.current = false
        connectedUdidsRef.current = []
        return
      }

      const currentUdid = udids[0]
      const isNewDevice = !connectedUdidsRef.current.includes(currentUdid)
      if (isNewDevice) {
        connectedUdidsRef.current = udids
        hasDataRef.current = false
        setStatus('connected')
        setDeviceData(null)
      }

      if (autoRead && !hasDataRef.current && !isReadingRef.current) {
        readDevice(currentUdid)
      } else if (hasDataRef.current) {
        setStatus('trusted')
      }
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }, [autoRead, readDevice])

  const refresh = useCallback(() => {
    hasDataRef.current = false
    connectedUdidsRef.current = []
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    checkStatus()
    pollRef.current = setInterval(checkStatus, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [checkStatus])

  return { status, deviceData, deviceCount, isReading, error, readDevice, refresh }
}