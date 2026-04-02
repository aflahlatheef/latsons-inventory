// src/renderer/src/hooks/useBarcodeScanner.ts
import { useEffect, useRef, useCallback, useState } from 'react'

interface UseBarcodeScanner {
  isListening: boolean
  lastScan: string | null
  startListening: () => void
  stopListening: () => void
  clearLastScan: () => void
}

/**
 * USB Barcode/QR scanners act as keyboard (HID) devices.
 * They send characters rapidly followed by an Enter key.
 * This hook captures that rapid input pattern and emits the scanned value.
 *
 * @param onScan - callback fired when a barcode is scanned
 * @param minLength - minimum barcode length to consider valid (default: 8)
 * @param scanTimeout - ms of inactivity before considering scan complete (default: 100)
 */
export function useBarcodeScanner(
  onScan?: (value: string) => void,
  minLength = 8,
  scanTimeout = 100
): UseBarcodeScanner {
  const bufferRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const callbackRef = useRef(onScan)

  // Keep callback ref current without causing re-renders
  useEffect(() => {
    callbackRef.current = onScan
  }, [onScan])

  const processBuffer = useCallback(() => {
    const value = bufferRef.current.trim()
    bufferRef.current = ''
    if (value.length >= minLength) {
      setLastScan(value)
      callbackRef.current?.(value)
    }
  }, [minLength])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if focus is on an input/textarea that shouldn't be intercepted
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'textarea') return

      // If it's an input with [data-scanner-target], allow it
      const isScannerInput = (e.target as HTMLElement).dataset.scannerTarget

      // Enter key = end of scan
      if (e.key === 'Enter') {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        if (bufferRef.current.length >= minLength) {
          processBuffer()
        } else {
          bufferRef.current = ''
        }
        return
      }

      // Only capture printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Reset timeout on each keystroke
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          // If we accumulated enough chars without Enter, it was probably
          // typed manually (not a scanner). Clear buffer.
          if (!isScannerInput) {
            bufferRef.current = ''
          }
        }, scanTimeout)
      }
    },
    [minLength, scanTimeout, processBuffer]
  )

  const startListening = useCallback(() => {
    window.addEventListener('keydown', handleKeyDown)
    setIsListening(true)
  }, [handleKeyDown])

  const stopListening = useCallback(() => {
    window.removeEventListener('keydown', handleKeyDown)
    setIsListening(false)
    bufferRef.current = ''
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [handleKeyDown])

  const clearLastScan = useCallback(() => setLastScan(null), [])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return { isListening, lastScan, startListening, stopListening, clearLastScan }
}