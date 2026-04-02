// src/renderer/src/label/LabelPreview.tsx
// ============================================================
// THE ONE TRUE LABEL RENDERER
// ============================================================
// Every place that shows a label (preview card, modal, print,
// PNG export) MUST use this component.  No other component
// should re-implement label HTML.
//
// To change how the label looks → edit this file only.
// To change dimensions / sizes → edit LabelConfig.ts only.

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { LABEL, LABEL_PADDING } from './LabelConfig'
import type { Product } from '../../../types/shared'

// ── Public types ─────────────────────────────────────────────────────────────

export interface LabelExtras {
  /** Badge text shown in the circular stamp.  Default: 'EU+' */
  region_badge?: 'EU+' | 'DU+'
  /** Activation status shown on the label.  Default: 'Yes' */
  activation?: string
  /** RegionInfo / REG field e.g. "CH/A".  Falls back to model_code. */
  reg?: string
  /** Batch number e.g. "RET0104FB" */
  batch_no?: string
}

interface LabelPreviewProps {
  product: Product
  extras?: LabelExtras
  /**
   * CSS scale factor applied via `zoom`.
   * 1 = native size (420 × 160 px).
   * Use 0.68 for sidebar previews, leave at 1 for print/export.
   */
  scale?: number
  /** Show a grey border + shadow (for on-screen previews).  Default true. */
  showBorder?: boolean
}

// ── LATSONS logo SVG ─────────────────────────────────────────────────────────

const LS_LOGO = `
<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg"
     width="${LABEL.LOGO.WIDTH}" height="${LABEL.LOGO.HEIGHT}" style="display:block;">
  <g transform="matrix(1,0,0,1,-9.445877,8.214131)">
    <path fill="#000" d="M73.796,94.531L74.103,296.797C74.847,322.839 82.681,344.407 99.83,361.112C119.222,379.52 143.155,388.335 170.512,389.915L289.814,389.67L216.463,340.415L318.491,389.316L364.881,389.598C397.492,386.439 425.016,371.874 436.043,344.82C448.318,316.691 447.771,288.422 436.454,260.034C422.759,232.983 397.129,219.912 365.538,215.17L260.639,214.233C244.705,212.357 235.565,204.376 232.766,190.742C231.356,175.964 233.645,164.646 240.499,155.712C247.065,149.15 255.306,146.411 267.548,146.872L422.757,147.87L423.633,93.657L256.635,94.384C224.949,96.762 199.755,114.528 189.917,131.855C182.28,148.102 179.772,163.296 179.871,177.953C180.151,199.783 186.249,217.587 195.46,233.638C204.861,246.454 220.42,254.968 240.455,261.545L358.024,265.233C371.087,266.615 388.158,273.994 392.365,297.524C396.036,318.053 380.612,338.766 357.353,338.026L171.544,336.518C158.322,335.296 147.295,330.499 138.837,321.519C131.207,315.844 127.641,306.606 127.934,293.984L127.393,94.369L73.796,94.531Z"/>
    <g transform="matrix(6.867655,0,0,6.867655,-618.506717,-2415.329317)">
      <text x="100.249" y="419.541"
            style="font-family:'Helvetica',Arial,sans-serif;font-size:12px;fill:#000;">LATSONS</text>
    </g>
  </g>
</svg>
`

// ── Component ─────────────────────────────────────────────────────────────────

export function LabelPreview({
  product,
  extras = {},
  scale = 1,
  showBorder = true,
}: LabelPreviewProps) {
  const barcodeRef  = useRef<SVGSVGElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Resolve extras with defaults
  const badge      = extras.region_badge ?? 'EU+'
  const activation = (() => {
    const raw = (extras.activation ?? 'Yes').toUpperCase()
    if (raw === 'ACTIVATED')     return 'YES'
    if (raw === 'NOT ACTIVATED') return 'NO'
    return raw
  })()
  const reg     = extras.reg     || product.model_code || ''
  const batchNo = extras.batch_no ?? ''

  // ── Barcode ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!barcodeRef.current) return
    try {
      JsBarcode(barcodeRef.current, product.imei || '000000000000000', {
        format:       'CODE128',
        width:         LABEL.BARCODE.WIDTH,
        height:        LABEL.BARCODE.HEIGHT,
        displayValue:  true,
        fontSize:      LABEL.BARCODE.FONT_SIZE,
        margin:        LABEL.BARCODE.MARGIN,
        textMargin:    LABEL.BARCODE.TEXT_MARGIN,
        background:   '#ffffff',
        lineColor:    '#000000',
      })
    } catch (e) {
      console.error('[LabelPreview] Barcode error:', e)
    }
  }, [product.imei])

  // ── QR code ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!qrCanvasRef.current) return
    QRCode.toCanvas(qrCanvasRef.current, LABEL.QR_URL, {
      width:  LABEL.QR.SIZE,
      margin: LABEL.QR.MARGIN,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error)
  }, []) // QR URL never changes – run once

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrapStyle: React.CSSProperties = {
    width:       LABEL.WIDTH_PX  * scale,
    height:      LABEL.HEIGHT_PX * scale,
    maxHeight:   LABEL.HEIGHT_PX * scale,
    fontFamily:  LABEL.FONTS.FAMILY,
    background: '#ffffff',
    border:      showBorder ? '1px solid #d0d0d0' : 'none',
    borderRadius: showBorder ? 6 : 0,
    padding:     LABEL_PADDING,
    boxShadow:   showBorder ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    boxSizing:  'border-box',
    overflow:   'hidden',
    color:      '#000',
  }

  const cellStyle: React.CSSProperties = {
    border:       LABEL.BOX.BORDER,
    borderRadius: LABEL.BOX.BORDER_RADIUS,
    padding:      `${LABEL.BOX.PADDING_Y}px ${LABEL.BOX.PADDING_X}px`,
  }

  const rowStyle: React.CSSProperties = {
    color:       '#000',
    fontWeight:   LABEL.FONTS.ROW_WEIGHT,
    fontSize:     LABEL.FONTS.ROW_SIZE,
    paddingBottom: 2,
    whiteSpace:  'nowrap',
  }

  const lastRowStyle: React.CSSProperties = { ...rowStyle, paddingBottom: 0 }

  return (
    <div style={wrapStyle} className="label-print-target">

      {/* ── Row 1: barcode · badge · logo ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>

        {/* Barcode – takes remaining width */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <svg
            ref={barcodeRef}
            style={{ width: '100%', maxWidth: 265, height: 'auto', display: 'block' }}
          />
        </div>

        {/* EU+ / DU+ circular badge */}
        <div style={{
          width:         LABEL.BADGE.SIZE,
          height:        LABEL.BADGE.SIZE,
          borderRadius: '50%',
          background:   'transparent',
          border:        `${LABEL.BADGE.BORDER_WIDTH}px solid #000`,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          flexShrink:    0,
        }}>
          <span style={{
            fontSize:      LABEL.FONTS.BADGE_SIZE,
            fontWeight:    LABEL.FONTS.BADGE_WEIGHT,
            color:        '#000',
            letterSpacing: '-0.5px',
          }}>
            {badge}
          </span>
        </div>

        {/* Logo */}
        <div
          style={{
            width:          LABEL.LOGO.WIDTH,
            flexShrink:     0,
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: LS_LOGO }}
        />
      </div>

      {/* ── Row 2: model title ─────────────────────────────────────────── */}
      <div style={{
        fontSize:      LABEL.FONTS.MODEL_SIZE,
        fontWeight:    LABEL.FONTS.MODEL_WEIGHT,
        color:        '#000',
        marginBottom:  3,
        letterSpacing: '-0.2px',
        lineHeight:    1.2,
      }}>
        {product.model}, {product.storage}, {product.model_code}
      </div>

      {/* ── Row 3: info boxes + QR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: LABEL.BOX.GAP, alignItems: 'stretch' }}>

        {/* Box 1: SNO / FACE ID / SIM / TESTED */}
        <div style={{ ...cellStyle, flex: 1.1 }}>
          {product.serial_number && (
            <div style={rowStyle}>SNO: {product.serial_number}</div>
          )}
          <div style={rowStyle}>FACE ID: {(product.face_id ?? 'WORKING').toUpperCase()}</div>
          <div style={rowStyle}>SIM: {product.sim_status}</div>
          <div style={lastRowStyle}>TESTED: {(product.test_status ?? 'FULLY').toUpperCase()}</div>
        </div>

        {/* Box 2: ACTIVATION / REG / B.NO */}
        <div style={{ ...cellStyle, flex: 0.9 }}>
          <div style={rowStyle}>ACTIVATION: {activation}</div>
          <div style={rowStyle}>REG: {reg}</div>
          {batchNo && <div style={lastRowStyle}>B.NO: {batchNo}</div>}
        </div>

        {/* Box 3: BH / GD / CLR / IOS */}
        <div style={cellStyle}>
          <div style={rowStyle}>BH: <strong>{product.battery_health}%</strong></div>
          <div style={rowStyle}>GD: <strong>{product.grade}</strong></div>
          <div style={rowStyle}>CLR: <strong>{product.color}</strong></div>
          <div style={lastRowStyle}>IOS: <strong>{product.ios_version?.replace('iOS ', '') ?? ''}</strong></div>
        </div>

        {/* QR code */}
        <div style={{ ...cellStyle, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <canvas
            ref={qrCanvasRef}
            style={{ display: 'block', width: LABEL.QR.SIZE, height: LABEL.QR.SIZE }}
          />
        </div>
      </div>

    </div>
  )
}