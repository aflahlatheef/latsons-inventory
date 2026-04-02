// src/renderer/src/components/label/LabelPreview.tsx
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { Product } from '../../../../types/shared'

export const LABEL_WIDTH_MM  = 100
export const LABEL_HEIGHT_MM = 45
export const LABEL_WIDTH_PX  = 420
export const LABEL_HEIGHT_PX = 170

export interface LabelExtras {
  region_badge?: 'EU+' | 'DU+'
  activation?: string    // "Yes" | "No"
  reg?: string           // e.g. "CH/A"
  batch_no?: string      // e.g. "RET0104FB"
}

interface LabelPreviewProps {
  product: Product
  extras?: LabelExtras
  showBorder?: boolean
  scale?: number
}

const LS_LOGO = `
<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="38" height="38" style="display:block;">
  <g transform="matrix(1,0,0,1,-9.445877,8.214131)">
    <path fill="#000" d="M73.796,94.531L74.103,296.797C74.847,322.839 82.681,344.407 99.83,361.112C119.222,379.52 143.155,388.335 170.512,389.915L289.814,389.67L216.463,340.415L318.491,389.316L364.881,389.598C397.492,386.439 425.016,371.874 436.043,344.82C448.318,316.691 447.771,288.422 436.454,260.034C422.759,232.983 397.129,219.912 365.538,215.17L260.639,214.233C244.705,212.357 235.565,204.376 232.766,190.742C231.356,175.964 233.645,164.646 240.499,155.712C247.065,149.15 255.306,146.411 267.548,146.872L422.757,147.87L423.633,93.657L256.635,94.384C224.949,96.762 199.755,114.528 189.917,131.855C182.28,148.102 179.772,163.296 179.871,177.953C180.151,199.783 186.249,217.587 195.46,233.638C204.861,246.454 220.42,254.968 240.455,261.545L358.024,265.233C371.087,266.615 388.158,273.994 392.365,297.524C396.036,318.053 380.612,338.766 357.353,338.026L171.544,336.518C158.322,335.296 147.295,330.499 138.837,321.519C131.207,315.844 127.641,306.606 127.934,293.984L127.393,94.369L73.796,94.531Z"/>
    <g transform="matrix(6.867655,0,0,6.867655,-618.506717,-2415.329317)">
      <text x="100.249" y="419.541" style="font-family:'Helvetica',Arial,sans-serif;font-size:12px;fill:#000;">LATSONS</text>
    </g>
  </g>
</svg>
`

export function LabelPreview({ product, extras = {}, showBorder = true, scale = 1 }: LabelPreviewProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const badge      = extras.region_badge ?? 'EU+'
  const activation = extras.activation   ?? 'Yes'
  const reg        = extras.reg          ?? product.model_code ?? ''
  const batchNo    = extras.batch_no     ?? ''

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, product.imei || '000000000000000', {
          format: 'CODE128',
          width: 1.15,
          height: 28,
          displayValue: true,
          fontSize: 8,
          margin: 1,
          background: '#ffffff',
          lineColor: '#000000',
          textMargin: 1,
        })
      } catch (e) {
        console.error('Barcode generation error:', e)
      }
    }
  }, [product.imei])

  useEffect(() => {
    if (qrCanvasRef.current) {
      const qrData = 'https://www.latsonsorginals.com/';
      QRCode.toCanvas(qrCanvasRef.current, qrData, {
        width: 64,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(console.error)
    }
  }, [product, reg, batchNo])

  const labelStyle: React.CSSProperties = {
    width:      `${LABEL_WIDTH_PX  * scale}px`,
    height:     `${LABEL_HEIGHT_PX * scale}px`,
    maxHeight:  `${LABEL_HEIGHT_PX * scale}px`,
    fontFamily: "'Space Grotesk', Arial, sans-serif",
    background: '#ffffff',
    border:     showBorder ? '1px solid #d0d0d0' : 'none',
    borderRadius: showBorder ? '6px' : '0',
    padding:    '10px 6px 6px 4px',
    boxShadow:  showBorder ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    boxSizing:  'border-box' as const,
    overflow:   'hidden',
  }

  const cellStyle: React.CSSProperties = {
    border: '1px solid #888',
    borderRadius: 4,
    padding: '3px 5px',
  }

  const rowStyle: React.CSSProperties = {
    color: '#000',
    fontWeight: 600,
    fontSize: 9,
    paddingBottom: 2,
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={labelStyle} className="label-print-target">
      {/* ── Header: barcode · badge · logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <svg ref={barcodeRef} style={{ width: '100%', maxWidth: 265, height: 'auto', display: 'block' }} />
        </div>

        {/* EU+ / DU+ badge — border only, no fill */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'transparent',
          border: '2px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#000', letterSpacing: '-0.5px' }}>{badge}</span>
        </div>

        {/* Logo */}
        <div style={{ width: 42, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          dangerouslySetInnerHTML={{ __html: LS_LOGO }} />
      </div>

      {/* ── Model title ── */}
      <div style={{ fontSize: 11, fontWeight: 800, color: '#000', marginBottom: 3, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
        {product.model}, {product.storage}, {product.model_code}
      </div>

      {/* ── 3-box row + QR ── */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>

        {/* Box 1: SNO / FACE ID / SIM / TESTED */}
        <div style={{ ...cellStyle, flex: 1.1 }}>
          {product.serial_number && (
            <div style={rowStyle}>SNO: {product.serial_number}</div>
          )}
          <div style={rowStyle}>FACE ID: {(product.face_id ?? 'WORKING').toUpperCase()}</div>
          <div style={rowStyle}>SIM: {product.sim_status}</div>
          <div style={{ ...rowStyle, paddingBottom: 0 }}>TESTED: {(product.test_status ?? 'FULLY').toUpperCase()}</div>
        </div>

        {/* Box 2: ACTIVATION / REG / B.NO */}
        <div style={{ ...cellStyle, flex: 0.9 }}>
          <div style={rowStyle}>
            ACTIVATION: {
              activation.toUpperCase() === 'ACTIVATED' ? 'YES'
              : activation.toUpperCase() === 'NOT ACTIVATED' ? 'NO'
              : activation.toUpperCase()
            }
          </div>
          <div style={rowStyle}>REG: {reg}</div>
          {batchNo && (
            <div style={{ ...rowStyle, paddingBottom: 0 }}>B.NO: {batchNo}</div>
          )}
        </div>

        {/* Box 3: BH / GD / CLR / IOS */}
        <div style={cellStyle}>
          <div style={rowStyle}>BH: <strong>{product.battery_health}%</strong></div>
          <div style={rowStyle}>GD: <strong>{product.grade}</strong></div>
          <div style={rowStyle}>CLR: <strong>{product.color}</strong></div>
          <div style={{ ...rowStyle, paddingBottom: 0 }}>
            IOS: <strong>{product.ios_version?.replace('iOS ', '') ?? ''}</strong>
          </div>
        </div>

        {/* QR code */}
        <div style={{ ...cellStyle, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <canvas ref={qrCanvasRef} style={{ display: 'block', width: 64, height: 64 }} />
        </div>
      </div>
    </div>
  )
}