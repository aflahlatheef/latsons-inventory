// src/renderer/src/label/labelUtils.ts
// ============================================================
// SHARED LABEL UTILITIES
// ============================================================
// All label-related helpers live here so every page imports
// from one place instead of duplicating logic.

import type { LabelWithProduct, Product } from '../../../types/shared'
import type { LabelExtras } from './LabelPreview'
import { LABEL } from './LabelConfig'

// ── Type helpers ─────────────────────────────────────────────────────────────

/**
 * Inflate a LabelWithProduct into a full Product shape so
 * LabelPreview can consume it without extra mapping at call sites.
 */
export function toFullProduct(label: LabelWithProduct): Product {
  return {
    id:             label.product_id,
    imei:           label.product.imei           as string,
    model:          label.product.model          as string,
    storage:        label.product.storage        as string,
    model_code:     label.product.model_code     as string,
    color:          label.product.color          as string,
    battery_health: label.product.battery_health as number,
    grade:          label.product.grade          as string,
    face_id:        label.product.face_id        as string,
    sim_status:     label.product.sim_status     as string,
    test_status:    label.product.test_status    as string,
    ios_version:    label.product.ios_version    as string,
    serial_number:  label.product.serial_number  as string | null,
    status:         label.product.status,
    notes:          null,
    created_at:     label.created_at,
    updated_at:     label.created_at,
  }
}

/**
 * Parse LabelExtras out of the JSON stored in `qr_data`.
 * Handles the legacy URL format gracefully.
 */
export function extrasFromQrData(qrData: string): LabelExtras {
  try {
    if (qrData.startsWith('http')) return {}   // old URL-only format
    const parsed = JSON.parse(qrData)
    return {
      region_badge: (parsed.badge as 'EU+' | 'DU+') ?? 'EU+',
      activation:   parsed.activation  ?? 'Yes',
      reg:          parsed.reg         ?? '',
      batch_no:     parsed.batch       ?? '',
    }
  } catch {
    return {}
  }
}

/**
 * Serialize LabelExtras into the JSON blob stored in `qr_data`.
 */
export function extrasToQrData(extras: {
  reg:          string
  activation:   string
  region_badge: 'EU+' | 'DU+'
  batch_no:     string
}): string {
  return JSON.stringify({
    reg:        extras.reg        || '',
    activation: extras.activation,
    badge:      extras.region_badge,
    batch:      extras.batch_no   || '',
  })
}

// ── PNG export ───────────────────────────────────────────────────────────────

/**
 * Render a label DOM element to a PNG Blob.
 * Pass the ref.current from a <div> that wraps <LabelPreview scale={1} showBorder={false} />.
 */
export async function labelElementToBlob(el: HTMLElement): Promise<Blob | null> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale:            LABEL.PNG_SCALE,
      useCORS:          true,
      logging:          false,
      width:            el.scrollWidth,
      height:           el.scrollHeight,
      windowWidth:      el.scrollWidth + 40,
    })
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}

/**
 * Download a single label as PNG.
 * The caller is responsible for having the label already mounted in the DOM.
 */
export function triggerPngDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download multiple labels as a ZIP of PNGs.
 * Falls back to sequential downloads if JSZip is unavailable.
 */
export async function downloadLabelsAsZip(
  labels:   { blob: Blob; filename: string }[],
  zipName:  string,
): Promise<void> {
  if (labels.length === 0) return
  if (labels.length === 1) {
    triggerPngDownload(labels[0].blob, labels[0].filename)
    return
  }
  try {
    const JSZip = (await import('jszip')).default
    const zip   = new JSZip()
    for (const { blob, filename } of labels) zip.file(filename, blob)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    triggerPngDownload(zipBlob, `${zipName}.zip`)
  } catch {
    // Fallback: download each file individually
    for (const { blob, filename } of labels) {
      triggerPngDownload(blob, filename)
      await new Promise(r => setTimeout(r, 200))
    }
  }
}